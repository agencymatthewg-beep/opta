"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Server, Laptop, Trash2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Device {
    id: string;
    device_label: string;
    platform: string;
    trust_state: string;
    last_seen_at: string;
}

export function ActiveDevicesPanel() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchDevices = useCallback(async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from("accounts_devices")
                .select("*")
                .eq("user_id", user.id)
                .neq("trust_state", "revoked")
                .order("last_seen_at", { ascending: false });

            if (data) setDevices(data);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        const id = setTimeout(() => {
            void fetchDevices();
        }, 0);
        return () => clearTimeout(id);
    }, [fetchDevices]);

    const revokeDevice = async (id: string) => {
        try {
            const res = await fetch(`/api/devices/${id}/revoke`, { method: "POST" });
            if (res.ok) {
                setDevices((prev) => prev.filter((d) => d.id !== id));
            }
        } catch (e) {
            console.error("Failed to revoke device", e);
        }
    };

    const getPlatformIcon = (platform: string) => {
        const p = platform.toLowerCase();
        if (p.includes("mac") || p.includes("darwin")) return <Laptop size={14} />;
        if (p.includes("win")) return <Monitor size={14} />;
        return <Server size={14} />;
    };

    if (loading) {
        return (
            <div className="glass rounded-2xl p-5 mb-4 animate-pulse">
                <h2 className="text-sm font-medium text-opta-text-secondary mb-3">Active Devices</h2>
                <div className="h-10 bg-white/5 rounded-lg w-full mb-2" />
                <div className="h-10 bg-white/5 rounded-lg w-full" />
            </div>
        );
    }

    if (devices.length === 0) return null;

    return (
        <div className="glass rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-medium text-opta-text-secondary">Connected Nodes</h2>
                <ShieldAlert size={14} className="text-opta-primary/70" />
            </div>
            <div className="space-y-2">
                {devices.map((device) => (
                    <div
                        key={device.id}
                        className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-lg",
                            "bg-white/[0.02] border border-white/[0.02] group"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-opta-primary/10 flex items-center justify-center text-opta-primary">
                                {getPlatformIcon(device.platform)}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-opta-text-primary capitalize flex items-center gap-2">
                                    {device.device_label}
                                    {device.trust_state === 'trusted' && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-opta-neon-green" />
                                    )}
                                </p>
                                <p className="text-xs text-opta-text-muted capitalize">
                                    {device.platform} • Active recently
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => revokeDevice(device.id)}
                            className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-opta-text-muted",
                                "opacity-0 group-hover:opacity-100 transition-all duration-200",
                                "hover:bg-opta-neon-red/10 hover:text-opta-neon-red"
                            )}
                            title="Revoke session"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
