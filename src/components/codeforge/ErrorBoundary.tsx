'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { children: React.ReactNode; name?: string };
type State = { hasError: boolean; error: Error | null };

export default class PanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
              <AlertCircle className="size-5 text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400">
              {this.props.name ? `${this.props.name} Error` : 'Component Error'}
            </p>
            <p className="max-w-[240px] text-xs text-zinc-500">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 text-xs"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="mr-1 size-3" /> Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
