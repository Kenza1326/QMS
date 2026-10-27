import React from 'react';
export class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {failed:boolean}> {
  declare props: {children: React.ReactNode};
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error: Error) { console.error('Queue application error', error); }
  render() {
    if (this.state.failed) return <main role="alert" className="p-8 text-center"><h1 className="font-bold text-xl">Une erreur est survenue</h1><p>Rechargez la page pour retrouver la file d’attente.</p><button className="mt-4 p-3 rounded bg-blue-700 text-white" onClick={() => window.location.reload()}>Réessayer</button></main>;
    return this.props.children;
  }
}

