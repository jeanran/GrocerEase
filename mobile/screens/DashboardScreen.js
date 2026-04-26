import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { colors, globalStyles } from '../styles/GlobalStyles';
import API_URL from '../config';

export default function DashboardScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [stats, setStats]         = useState(null);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard/stats/`);
            const data = await res.json();
            if (data.success) setStats(data);
        } catch (err) {
            Alert.alert('Error', 'Failed to load dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadStats(); }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadStats();
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => navigation.replace('Login') },
        ]);
    };

    if (loading) {
        return (
            <View style={globalStyles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[globalStyles.subtext, { marginTop: 12 }]}>Loading dashboard...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>GrocerEase</Text>
                    <Text style={styles.headerSub}>Welcome, {user?.username}</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                }
            >
                {/* Role Badge */}
                <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Admin Dashboard</Text>
                </View>

                {/* Stat Cards */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
                        <Text style={styles.statLabel}>TOTAL PRODUCTS</Text>
                        <Text style={styles.statValue}>{stats?.total_products ?? 0}</Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
                        <Text style={styles.statLabel}>LOW STOCK</Text>
                        <Text style={[styles.statValue, { color: colors.warning }]}>
                            {stats?.low_stock ?? 0}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
                        <Text style={styles.statLabel}>TODAY'S SALES</Text>
                        <Text style={[styles.statValue, { color: colors.success }]}>
                            ₱{(stats?.today_sales ?? 0).toFixed(2)}
                        </Text>
                    </View>

                    <View style={[styles.statCard, { borderLeftColor: colors.secondary }]}>
                        <Text style={styles.statLabel}>TRANSACTIONS</Text>
                        <Text style={styles.statValue}>{stats?.total_transactions ?? 0}</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>

                <View style={styles.actionsGrid}>
                    <TouchableOpacity
                        style={[styles.actionCard, { backgroundColor: colors.primary }]}
                        onPress={() => navigation.navigate('POS', { user })}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.actionIcon}>🛒</Text>
                        <Text style={styles.actionText}>New Sale</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionCard, { backgroundColor: colors.secondary }]}
                        onPress={onRefresh}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.actionIcon}>🔄</Text>
                        <Text style={styles.actionText}>Refresh</Text>
                    </TouchableOpacity>
                </View>

                {/* Info Note */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                        Pull down to refresh stats. Full reports are available on the web dashboard.
                    </Text>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        backgroundColor: colors.primary,
        padding: 20,
        paddingTop: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
    headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    logoutBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    scroll: { flex: 1, padding: 16 },

    // Role badge
    roleBadge: {
        backgroundColor: '#d4edda',
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 20,
        marginBottom: 16,
        marginTop: 4,
    },
    roleBadgeText: { color: '#155724', fontWeight: '700', fontSize: 13 },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    statCard: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: 16,
        width: '47%',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 8, letterSpacing: 0.5 },
    statValue: { fontSize: 26, fontWeight: '800', color: colors.dark },

    // Section
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginBottom: 12 },

    // Actions
    actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    actionCard: {
        flex: 1, borderRadius: 14, padding: 20,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.1,
        shadowRadius: 8, elevation: 3,
    },
    actionIcon: { fontSize: 28, marginBottom: 8 },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Info
    infoBox: {
        backgroundColor: '#f0faf4',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.accent,
        marginBottom: 30,
    },
    infoText: { color: colors.primary, fontSize: 13, lineHeight: 20 },
});