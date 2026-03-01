import { motion } from 'framer-motion';
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Copy,
    Database,
    Key,
    RefreshCw,
    Terminal,
} from 'lucide-react';
import { Button, cn } from '@opta/ui';
import { type DiagnosticCategory } from '@/lib/connection';
import { useState } from 'react';

interface RescueScreenProps {
    diagnostic: DiagnosticCategory;
    errorMsg: string | null;
    onRetry: () => void;
}

export function RescueScreen({
    diagnostic,
    errorMsg,
    onRetry,
}: RescueScreenProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyCommand = () => {
        navigator.clipboard.writeText('lmx run');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    type StatusType = 'success' | 'error' | 'pending';
    interface DiagnosticState {
        network: StatusType;
        auth: StatusType;
        hardware: StatusType;
        title: string;
        suggestion?: string;
    }

    const getDiagnosticsState = (): DiagnosticState => {
        switch (diagnostic) {
            case 'OK':
                return {
                    network: 'success',
                    auth: 'success',
                    hardware: 'success',
                    title: 'All Systems Operational',
                };
            case 'UNAUTHORIZED':
                return {
                    network: 'success',
                    auth: 'error',
                    hardware: 'pending',
                    title: 'Authentication Rejected',
                    suggestion:
                        'Your Admin Key is invalid or expired. Please update it in Settings.',
                };
            case 'NODE_DOWN':
            case 'TIMEOUT':
                return {
                    network: 'error',
                    auth: 'pending',
                    hardware: 'pending',
                    title: 'Daemon Unreachable',
                    suggestion: 'The LMX daemon is not running on the specified port.',
                };
            default:
                return {
                    network: 'error',
                    auth: 'pending',
                    hardware: 'pending',
                    title: 'Unknown Connection Error',
                    suggestion: errorMsg || 'Could not reach the local node.',
                };
        }
    };

    const state = getDiagnosticsState();

    const DiagnosticRow = ({
        status,
        label,
        icon: Icon,
    }: {
        status: 'success' | 'error' | 'pending';
        label: string;
        icon: React.ElementType;
    }) => {
        return (
            <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                        status === 'success' && 'bg-emerald-500/10 text-emerald-500',
                        status === 'error' && 'bg-rose-500/10 text-rose-500',
                        status === 'pending' && 'bg-white/5 text-white/40'
                    )}
                >
                    {status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5" />
                    ) : status === 'error' ? (
                        <AlertCircle className="h-5 w-5" />
                    ) : (
                        <Icon className="h-5 w-5 opacity-50" />
                    )}
                </div>
                <div className="flex-1">
                    <p
                        className={cn(
                            'font-medium',
                            status === 'pending' ? 'text-white/40' : 'text-white/90'
                        )}
                    >
                        {label}
                    </p>
                    <p className="text-xs text-white/40">
                        {status === 'success' && 'Verified operational'}
                        {status === 'error' && 'Checkpoint failed'}
                        {status === 'pending' && 'Awaiting previous step...'}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-full w-full items-center justify-center p-8"
        >
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-3xl">
                <div className="border-b border-white/10 p-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 ring-1 ring-white/10">
                        <Activity className="h-8 w-8 text-rose-400" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold text-white/90">
                        {state.title}
                    </h2>
                    <p className="text-sm text-white/50">{state.suggestion}</p>
                </div>

                <div className="flex flex-col gap-3 p-6">
                    <DiagnosticRow
                        status={state.network}
                        label="Network Layer (Daemon)"
                        icon={Activity}
                    />
                    <DiagnosticRow
                        status={state.auth}
                        label="Security Layer (Auth Key)"
                        icon={Key}
                    />
                    <DiagnosticRow
                        status={state.hardware}
                        label="Hardware Pool (VRAM Access)"
                        icon={Database}
                    />

                    {(diagnostic === 'NODE_DOWN' || diagnostic === 'TIMEOUT') && (
                        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                            <p className="mb-3 text-sm font-medium text-blue-400">
                                Action Required: Start LMX Daemon
                            </p>
                            <div className="flex items-center gap-2 rounded-lg bg-black/60 p-1 pl-3 font-mono text-sm text-blue-200 shadow-inner">
                                <Terminal className="h-4 w-4 opacity-50" />
                                <span className="flex-1">lmx run</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyCommand}
                                    className="h-8 hover:bg-white/10 hover:text-white"
                                >
                                    {copied ? (
                                        <span className="text-xs text-emerald-400">Copied!</span>
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        <Button
                            className="flex-1 bg-white/10 text-white hover:bg-white/20"
                            onClick={onRetry}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retest Connection
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
