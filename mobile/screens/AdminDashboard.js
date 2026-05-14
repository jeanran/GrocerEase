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

// Theme colors - MATCHING YOUR WEB APP
const COLORS = {
    primary: '#1e6f5c',      // Main teal from web
    primaryLight: '#e8f5f1',   // Light teal background
    accent: '#29c98f',        // Accent green
    danger: '#e17055',        // Coral red for errors
    warning: '#f39c12',       // Orange for warnings
    success: '#27ae60',       // Success green
    bg: '#f0f2f5',           // Background gray
    white: '#ffffff',
    border: '#e2e8f0',
    text: '#2d3436',
    textMuted: '#718096',
    sidebar: '#1e2d3d',      // Dark sidebar
    cardShadow: '#000',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);

export default function AdminDashboard({ navigation, route }) {
    const { user } = route.params || {};
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        total_products: 0,
        low_stock: 0,
        total_transactions: 0,
        today_sales: 0,
    });
    const [lowStockProducts, setLowStockProducts] = useState([]);
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [drawerOpen, setDrawerOpen] = useState(false);
    
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
                fetch(`${API_URL}/api/products/`),
                fetch(`${API_URL}/api/transactions/`),
            ]);
            
            const statsData = await statsRes.json();
            const productsData = await productsRes.json();
            const transactionsData = await transactionsRes.json();
            
            if (statsData.success) {
                setStats(statsData);
            }
            
            if (productsData.success) {
                const lowStock = productsData.products.filter(p => p.stock <= 5);
                setLowStockProducts(lowStock);
            }
            
            if (transactionsData.success) {
                setRecentTransactions(transactionsData.transactions.slice(0, 5));
            }
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
    
    const navigateToPOS = () => {
        closeDrawer();
        navigation.replace('POSScreen', { user });
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
            
            {/* Drawer Sidebar - Matching web sidebar */}
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
                        
                        <TouchableOpacity style={styles.navItem} onPress={navigateToPOS}>
                            <MaterialIcons name="point-of-sale" size={20} color={COLORS.white} />
                            <Text style={styles.navItemText}>Point of Sale</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
                            <FontAwesome5 name="boxes" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stocks</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
                            <FontAwesome5 name="chart-line" size="18" color={COLORS.white} />
                            <Text style={styles.navItemText}>Reports</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
                            <FontAwesome5 name="users" size="16" color={COLORS.white} />
                            <Text style={styles.navItemText}>Manage Users</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.drawerLogout} onPress={() => navigation.replace('Login')}>
                            <Ionicons name="log-out-outline" size="20" color={COLORS.danger} />
                            <Text style={styles.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}
            
            {/* Header - Matching web header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={openDrawer}>
                    <MaterialIcons name="menu" size="26" color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <View style={styles.userBadge}>
                    <FontAwesome5 name="user-circle" size="24" color={COLORS.primary} />
                </View>
            </View>
            
            <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Stats Cards - Matching web design */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <FontAwesome5 name="box" size="22" color={COLORS.primary} />
                        </View>
                        <Text style={styles.statNumber}>{stats.total_products}</Text>
                        <Text style={styles.statLabel}>Total Products</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                        <View style={[styles.statIconBg, { backgroundColor: '#fff3e0' }]}>
                            <FontAwesome5 name="exclamation-triangle" size="20" color={COLORS.warning} />
                        </View>
                        <Text style={[styles.statNumber, stats.low_stock > 0 && { color: COLORS.warning }]}>
                            {stats.low_stock}
                        </Text>
                        <Text style={styles.statLabel}>Low Stock</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <Ionicons name="receipt-outline" size="22" color={COLORS.primary} />
                        </View>
                        <Text style={styles.statNumber}>{stats.total_transactions}</Text>
                        <Text style={styles.statLabel}>Transactions</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                        <View style={styles.statIconBg}>
                            <FontAwesome5 name="money-bill-wave" size="20" color={COLORS.accent} />
                        </View>
                        <Text style={styles.statNumber}>₱{stats.today_sales?.toFixed(2) || '0'}</Text>
                        <Text style={styles.statLabel}>Today's Sales</Text>
                    </View>
                </View>
                
                {/* Low Stock Alerts - Matching web warning style */}
                {lowStockProducts.length > 0 && (
                    <View style={styles.alertSection}>
                        <View style={styles.sectionHeader}>
                            <FontAwesome5 name="bell" size="18" color={COLORS.danger} />
                            <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
                        </View>
                        {lowStockProducts.map(product => (
                            <View key={product.product_id} style={styles.alertItem}>
                                <View style={styles.alertIcon}>
                                    <FontAwesome5 name="cube" size="14" color={COLORS.danger} />
                                </View>
                                <View style={styles.alertInfo}>
                                    <Text style={styles.alertName}>{product.name}</Text>
                                    <Text style={styles.alertStock}>Stock: {product.stock} {product.unit}</Text>
                                </View>
                                <TouchableOpacity style={styles.restockBtn}>
                                    <Text style={styles.restockBtnText}>Restock</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
                
                {/* Recent Transactions */}
                <View style={styles.transactionSection}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="time-outline" size="18" color={COLORS.text} />
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
                                <Text style={styles.transactionAmount}>₱{transaction.total.toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>
                
                {/* Quick Actions - Matching web button style */}
                <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.primaryBtn} onPress={navigateToPOS}>
                        <FontAwesome5 name="shopping-cart" size="18" color={COLORS.white} />
                        <Text style={styles.primaryBtnText}>Open POS</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryBtn}>
                        <FontAwesome5 name="clipboard-list" size="18" color={COLORS.primary} />
                        <Text style={styles.secondaryBtnText}>View Inventory</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bg },
    
    loadingScreen: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: COLORS.bg 
    },
    loadingText: { 
        marginTop: 12, 
        color: COLORS.textMuted, 
        fontSize: 14,
        fontFamily: 'System',
    },
    
    // Sidebar styles - matching web
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    drawer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: DRAWER_W,
        backgroundColor: COLORS.sidebar,
        paddingTop: 56,
        zIndex: 99,
        elevation: 5,
    },
    drawerLogo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    logoIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'System',
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    navItemText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        fontFamily: 'System',
    },
    drawerLogout: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
        marginTop: 16,
        marginHorizontal: 12,
    },
    drawerLogoutText: {
        color: COLORS.danger,
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'System',
    },
    
    // Header styles
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        fontFamily: 'System',
    },
    userBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    // Stats grid
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: COLORS.cardShadow,
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    statIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.text,
        fontFamily: 'System',
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
        textAlign: 'center',
        fontFamily: 'System',
    },
    
    // Alert section
    alertSection: {
        backgroundColor: COLORS.white,
        margin: 12,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        fontFamily: 'System',
    },
    alertItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    alertIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8d7da',
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertInfo: {
        flex: 1,
    },
    alertName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        fontFamily: 'System',
    },
    alertStock: {
        fontSize: 12,
        color: COLORS.danger,
        marginTop: 2,
        fontFamily: 'System',
    },
    restockBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    restockBtnText: {
        color: COLORS.white,
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'System',
    },
    
    // Transaction section
    transactionSection: {
        backgroundColor: COLORS.white,
        margin: 12,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    transactionId: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        fontFamily: 'System',
    },
    transactionDate: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: 2,
        fontFamily: 'System',
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        fontFamily: 'System',
    },
    
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: 14,
        fontFamily: 'System',
    },
    
    // Quick actions
    quickActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        marginBottom: 20,
    },
    primaryBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    primaryBtnText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'System',
    },
    secondaryBtn: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    secondaryBtnText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'System',
    },
});