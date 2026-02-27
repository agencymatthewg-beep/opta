"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[WidgetErrorBoundary] ${this.props.widgetName || "Widget"} crashed:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-neon-amber mb-2" />
          <p className="text-sm text-text-muted mb-1">
            {this.props.widgetName || "Widget"} encountered an error
          </p>
          <p className="text-xs text-text-muted/60 mb-3 max-w-[200px] truncate">
            {this.state.error?.message}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-glow transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
