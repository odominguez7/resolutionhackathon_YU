import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center px-6 text-center" style={{ background: "#0a0b0d" }}>
          <AlertTriangle className="w-10 h-10 mb-4" style={{ color: "#FF5D6C" }} />
          <h2 className="text-lg font-black text-white mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-500 max-w-sm mb-4">{this.state.error || "An unexpected error occurred."}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: "" }); window.location.reload(); }}
            className="px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-0 flex items-center gap-2"
            style={{ background: "rgba(255,92,53,0.15)", color: "#FF5C35" }}>
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
