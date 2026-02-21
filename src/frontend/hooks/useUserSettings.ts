'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';

export interface UserSettings {
    polling_interval: number;
    alert_threshold: number;
    telegram_user_id?: string;
    alerts_enabled?: boolean;
}

export function useUserSettings() {
    const { address } = useAccount();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchUserSettings = async () => {
            if (!address) {
                setSettings(null);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('wallet_address', address.toLowerCase())
                    .single();

                if (error || !data) {
                    // Default settings if not found
                    setSettings({ polling_interval: 60, alert_threshold: 1.1 });
                } else {
                    setSettings(data);
                }
            } catch (err) {
                console.error('Error fetching user settings:', err);
                setSettings({ polling_interval: 60, alert_threshold: 1.1 });
            } finally {
                setLoading(false);
            }
        };

        fetchUserSettings();
    }, [address]);

    return { settings, loading };
}
