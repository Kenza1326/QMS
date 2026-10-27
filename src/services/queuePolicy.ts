import {QueueTicket, CounterStation, QueueRule, RuleScoreBreakdown} from '../types/queueTypes';
export function evaluateTickets(tickets: QueueTicket[], counters: CounterStation[], rules: QueueRule[], counterId?: string, now = Date.now()): RuleScoreBreakdown[] {
    const ruleR01 = rules.find((r) => r.code === 'R-01');
    const ruleR02 = rules.find((r) => r.code === 'R-02');
    const ruleR03 = rules.find((r) => r.code === 'R-03');
    const ruleR04 = rules.find((r) => r.code === 'R-04');
    const ruleR05 = rules.find((r) => r.code === 'R-05');
    const ruleR06 = rules.find((r) => r.code === 'R-06');
    const ruleR07 = rules.find((r) => r.code === 'R-07');
    const ruleR12 = rules.find((r) => r.code === 'R-12');

    const counter = counterId ? counters.find((c) => c.id === counterId) : undefined;

    const waitingTickets = tickets.filter((t) => t.status === 'waiting');
    const breakdowns: RuleScoreBreakdown[] = [];

    for (const ticket of waitingTickets) {
      const appliedRules: string[] = [];

      // Check Counter Specialization (R-05) and Load Balancing / Overflow (R-07)
      if (counter) {
        const assigned = counter.assignedCategoryIds || [];
        const isDirectSpecialty = assigned.includes(ticket.categoryId);

        if (!isDirectSpecialty) {
          // Check R-07 Overflow
          const overflowEnabled = ruleR07?.enabled && ruleR07?.parameters?.allowOverflow?.value !== false;
          const congestionLimit = Number(ruleR07?.parameters?.congestionThreshold?.value || 5);
          const categoryWaitingCount = waitingTickets.filter((t) => t.categoryId === ticket.categoryId).length;

          if (overflowEnabled && categoryWaitingCount >= congestionLimit) {
            appliedRules.push('R-07');
          } else {
            // Cannot be served by this counter if R-05 is enabled
            if (ruleR05?.enabled && ruleR05?.parameters?.strictSpecialization?.value !== false) {
              continue;
            }
          }
        } else {
          appliedRules.push('R-05');
        }
      }

      // 1. Base Wait Score (R-04 FIFO)
      const waitMinutes = Math.max(0, Math.floor((now - new Date(ticket.confirmedAt || ticket.createdAt).getTime()) / (1000 * 60)));
      const waitWeight = ruleR04?.enabled ? Number(ruleR04?.parameters?.waitWeightPerMinute?.value || 1) : 1;
      const baseWaitScore = waitMinutes * waitWeight;
      if (ruleR04?.enabled) appliedRules.push('R-04');

      // 2. PMR Priority (R-01)
      let pmrBonus = 0;
      if (ticket.priority === 'pmr' && ruleR01?.enabled) {
        const boost = Number(ruleR01?.parameters?.boostFactor?.value || 100);
        const headOfLine = ruleR01?.parameters?.headOfLine?.value !== false;
        pmrBonus = headOfLine ? boost + 500 : boost;
        appliedRules.push('R-01');
      }

      // 3. VIP Priority (R-02)
      let vipBonus = 0;
      if (ticket.priority === 'vip' && ruleR02?.enabled) {
        vipBonus = Number(ruleR02?.parameters?.boostFactor?.value || 50);
        appliedRules.push('R-02');
      }

      // 4. Appointment Punctuality (R-03)
      let appointmentBonus = 0;
      if (ticket.appointmentTime && ruleR03?.enabled) {
        const tolMins = Number(ruleR03?.parameters?.arrivalToleranceMinutes?.value || 15);
        const slotBonus = Number(ruleR03?.parameters?.slotPriority?.value || 60);
        const [appH, appM] = ticket.appointmentTime.split(':').map(Number);
        if (!isNaN(appH) && !isNaN(appM)) {
          const nowDate = new Date();
          const targetDate = new Date();
          targetDate.setHours(appH, appM, 0, 0);
          const diffMinutes = Math.abs(nowDate.getTime() - targetDate.getTime()) / (1000 * 60);
          if (diffMinutes <= tolMins) {
            appointmentBonus = slotBonus;
            appliedRules.push('R-03');
          }
        }
      }

      // 5. Dynamic SLA Escalation (R-06)
      let slaEscalationBonus = 0;
      if (ruleR06?.enabled) {
        const criticalThreshold = Number(ruleR06?.parameters?.criticalWaitMinutes?.value || 20);
        if (waitMinutes >= criticalThreshold) {
          slaEscalationBonus = Number(ruleR06?.parameters?.slaBoostWeight?.value || 40);
          appliedRules.push('R-06');
        }
      }

      // 6. Active Wait KYC Completion Bonus (R-12)
      let kycBonus = 0;
      if (ticket.kycDossier?.status === 'completed' && ruleR12?.enabled) {
        kycBonus = Number(ruleR12?.parameters?.kycBonusPriority?.value || 15);
        appliedRules.push('R-12');
      }

      const totalScore = baseWaitScore + pmrBonus + vipBonus + appointmentBonus + slaEscalationBonus + kycBonus;

      breakdowns.push({
        ticket,
        baseWaitScore,
        pmrBonus,
        vipBonus,
        appointmentBonus,
        slaEscalationBonus,
        kycBonus,
        totalScore,
        appliedRules: Array.from(new Set(appliedRules)),
        calculatedRank: 0,
      });
    }

    // PMR head-of-line is absolute when enabled; other priorities use weighted scores and aging.
    breakdowns.sort((a, b) => {
      if (ruleR01?.enabled && ruleR01.parameters?.headOfLine?.value !== false) {
        const pmrOrder = Number(b.ticket.priority === 'pmr') - Number(a.ticket.priority === 'pmr');
        if (pmrOrder) return pmrOrder;
      }
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return new Date(a.ticket.confirmedAt || a.ticket.createdAt).getTime() - new Date(b.ticket.confirmedAt || b.ticket.createdAt).getTime();
    });

    breakdowns.forEach((b, idx) => {
      b.calculatedRank = idx + 1;
    });

    return breakdowns;
}
