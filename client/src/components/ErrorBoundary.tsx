import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{children:ReactNode},{hasError:boolean}> {
  state={hasError:false};
  static getDerivedStateFromError(){return {hasError:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('Application error',error,info)}
  render(){if(this.state.hasError)return <main className="page-center"><section className="empty"><h1>Something went wrong</h1><p>The page could not be displayed. Your account data has not been changed.</p><button className="button" onClick={()=>window.location.reload()}>Reload page</button></section></main>;return this.props.children}
}
