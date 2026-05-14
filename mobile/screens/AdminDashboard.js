// AdminDashboard.js - Consistent with web theme
import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, ScrollView, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_URL from '../config';

const COLORS = {
    primary:      '#1e6f5c',
    primaryLight: '#e8f5f1',
    accent:       '#29c98f',
    danger:       '#e17055',
    warning:      '#f39c12',
    success:      '#27ae60',
    bg:           '#f0f2f5',
    white:        '#ffffff',
    border:       '#e2e8f0',
    text:         '#2d3436',
    textMuted:    '#718096',
    sidebar:      '#1e2d3d',
    cardShadow:   '#000',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);

export default function AdminDashboard({ navigation, route }) {
    const { user } = route.params || {};

    const [loading,             setLoading]             = useState(true);
    const [refreshing,          setRefreshing]          = useState(false);
    const [stats,               setStats]               = useState({
        total_products: 0, low_stock: 0, total_transactions: 0, today_sales: 0,
    });
    const [lowStockProducts,    setLowStockProducts]    = useState([]);
    const [recentTransactions,  setRecentTransactions]  = useState([]);
    const [drawerOpen,          setDrawerOpen]          = useState(false);

    const drawerX = new Animated.Value(-DRAWER_W);

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const loadDashboardData = useCallback(async () => {
        try {
            const [statsRes, productsRes, transactionsRes] = await Promise.all([
                fetch(`${API_URL}/api/dashboard/stats/`),
                fetch(`${API_URL}/api/mobile/products/`),
                fetch(`${API_URL}/api/transactions/`),
            ]);

            const statsData        = await statsRes.json();
            const productsData     = await productsRes.json();
            const transactionsData = await transactionsRes.json();

            if (statsData.success)        setStats(statsData);
            if (productsData.success) {
                const lowStock = productsData.products.filter(
                    p => p.stock <= (p.reorder_level || 10)
                );
                setLowStockProducts(lowStock);
            }
            if (transactionsData.success) setRecentTransactions(transactionsData.transactions.slice(0, 5));

        } catch (err) {
            Alert.alert('Error', 'Failed to load dashboard data: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 30000);
        return () => clearInterval(interval);
    }, [loadDashboardData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadDashboardData();
    };

    const handleLogout = () => {
        closeDrawer();
        navigation.replace('Login');
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingScreen}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading Dashboard...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            {/* Drawer Sidebar */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={styles.backdrop} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>

                        <View style={styles.drawerLogo}>
                            <View style={styles.logoIcon}>
                                <FontAwesome5 name="store" size={18} color={COLORS.white} />
                            </View>
                            <Text style={styles.logoText}>
                                Grocer<Text style={{ color: COLORS.accent }}>Ease</Text>
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.navItem} onPress={closeDrawer}>
                            <FontAwesome5 name="tachometer-alt" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={closeDrawer}>
                            <FontAwesome5 name="boxes" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stocks</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={closeDrawer}>
                            <FontAwesome5 name="arrow-circle-down" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stock In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={closeDrawer}>
                            <FontAwesome5 name="arrow-circle-up" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stock Out</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={closeDrawer}>
                            <FontAwesome5 name="chart-line" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Reports</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                            <Text style={styles.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>

                    </Animated.View>
                </Modal>
            )}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openDrawer}>
                    <MaterialIcons name="menu" size={26} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <View style={styles.userBadge}>
                    <FontAwesome5 name="user-circle" size={24} color={COLORS.primary} />
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Welcome */}
                <View style={styles.welcomeRow}>
                    <Text style={styles.welcomeText}>
                        Welcome, <Text style={styles.welcomeName}>{user?.username || 'Admin'}</Text>
                    </Text>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <FontAwesome5 name="box" size={22} color={COLORS.primary} />
                        </View>
                        <Text style={styles.statNumber}>{stats.total_products}</Text>
                        <Text style={styles.statLabel}>Total Products</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: '#fff3e0' }]}>
                            <FontAwesome5 name="exclamation-triangle" size={20} color={COLORS.warning} />
                        </View>
                        <Text style={[styles.statNumber, stats.low_stock > 0 && { color: COLORS.warning }]}>
                            {stats.low_stock}
                        </Text>
                        <Text style={styles.statLabel}>Low Stock</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
                        </View>
                        <Text style={styles.statNumber}>{stats.total_transactions}</Text>
                        <Text style={styles.statLabel}>Transactions</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <FontAwesome5 name="money-bill-wave" size={20} color={COLORS.accent} />
                        </View>
                        <Text style={styles.statNumber}>
                            ₱{parseFloat(stats.today_sales || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.statLabel}>Today's Sales</Text>
                    </View>
                </View>

                {/* Low Stock Alerts */}
                {lowStockProducts.length > 0 && (
                    <View style={styles.alertSection}>
                        <View style={styles.sectionHeader}>
                            <FontAwesome5 name="bell" size={16} color={COLORS.danger} />
                            <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
                        </View>
                        {lowStockProducts.map(product => (
                            <View key={product.product_id} style={styles.alertItem}>
                                <View style={styles.alertIcon}>
                                    <FontAwesome5 name="cube" size={14} color={COLORS.danger} />
                                </View>
                                <View style={styles.alertInfo}>
                                    <Text style={styles.alertName}>{product.name}</Text>
                                    <Text style={styles.alertStock}>
                                        Stock: {product.stock} {product.unit || ''}
                                    </Text>
                                </View>
                                <View style={styles.restockBtn}>
                                    <Text style={styles.restockBtnText}>Low</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Recent Transactions */}
                <View style={styles.transactionSection}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="time-outline" size={18} color={COLORS.text} />
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    </View>
                    {recentTransactions.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No transactions yet</Text>
                        </View>
                    ) : (
                        recentTransactions.map(transaction => (
                            <View key={transaction.transaction_id} style={styles.transactionItem}>
                                <View>
                                    <Text style={styles.transactionId}>#{transaction.short_id}</Text>
                                    <Text style={styles.transactionDate}>
                                        {new Date(transaction.date).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Text style={styles.transactionAmount}>
                                    ₱{parseFloat(transaction.total).toFixed(2)}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root:        { flex: 1, backgroundColor: COLORS.bg },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
    loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },

    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    drawer: {
        position:        'absolute',
        top:             0,
        left:            0,
        bottom:          0,
        width:           DRAWER_W,
        backgroundColor: COLORS.sidebar,
        paddingTop:      56,
        zIndex:          99,
        elevation:       5,
    },
    drawerLogo: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             12,
        paddingHorizontal: 20,
        paddingBottom:   32,
    },
    logoIcon: {
        width:           38,
        height:          38,
        borderRadius:    10,
        backgroundColor: COLORS.primary,
        alignItems:      'center',
        justifyContent:  'center',
    },
    logoText:    { fontSize: 22, fontWeight: '700', color: '#fff' },

    navItem: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 12,
        borderRadius:    10,
        marginBottom:    8,
    },
    navItemText: { color: '#fff', fontSize: 15, fontWeight: '500' },

    drawerLogout: {
        flexDirection:   'row',
        alignItems:      'center',
        gap:             10,
        paddingHorizontal: 20,
        paddingVertical: 14,
        marginTop:       16,
        marginHorizontal: 12,
    },
    drawerLogoutText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },

    header: {
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingHorizontal: 16,
        paddingVertical:   12,
        backgroundColor:   COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        elevation:         2,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    userBadge: {
        width:           36,
        height:          36,
        borderRadius:    18,
        backgroundColor: COLORS.primaryLight,
        alignItems:      'center',
        justifyContent:  'center',
    },

    welcomeRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
    welcomeText: { fontSize: 14, color: COLORS.textMuted },
    welcomeName: { fontWeight: '700', color: COLORS.text },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
    statCard: {
        flex:            1,
        minWidth:        '45%',
        backgroundColor: COLORS.white,
        borderRadius:    12,
        padding:         16,
        alignItems:      'center',
        elevation:       2,
    },
    statIconBg: {
        width:           48,
        height:          48,
        borderRadius:    24,
        backgroundColor: COLORS.primaryLight,
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    8,
    },
    statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    statLabel:  { fontSize: 12, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

    alertSection: {
        backgroundColor: COLORS.white,
        margin:          12,
        borderRadius:    12,
        padding:         16,
        elevation:       2,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle:  { fontSize: 16, fontWeight: '700', color: COLORS.text },

    alertItem: {
        flexDirection:     'row',
        alignItems:        'center',
        gap:               12,
        paddingVertical:   12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    alertIcon: {
        width:           32,
        height:          32,
        borderRadius:    16,
        backgroundColor: '#f8d7da',
        alignItems:      'center',
        justifyContent:  'center',
    },
    alertInfo:    { flex: 1 },
    alertName:    { fontSize: 14, fontWeight: '600', color: COLORS.text },
    alertStock:   { fontSize: 12, color: COLORS.danger, marginTop: 2 },
    restockBtn: {
        backgroundColor:  '#f8d7da',
        paddingHorizontal: 10,
        paddingVertical:   4,
        borderRadius:      6,
    },
    restockBtnText: { color: COLORS.danger, fontSize: 11, fontWeight: '600' },

    transactionSection: {
        backgroundColor: COLORS.white,
        margin:          12,
        borderRadius:    12,
        padding:         16,
        elevation:       2,
    },
    transactionItem: {
        flexDirection:     'row',
        justifyContent:    'space-between',
        alignItems:        'center',
        paddingVertical:   12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    transactionId:     { fontSize: 14, fontWeight: '600', color: COLORS.text },
    transactionDate:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: '700', color: COLORS.primary },

    emptyState: { padding: 40, alignItems: 'center' },
    emptyText:  { color: COLORS.textMuted, fontSize: 14 },
});