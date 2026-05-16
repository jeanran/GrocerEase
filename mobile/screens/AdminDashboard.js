// AdminDashboard.js - Consistent with web theme
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, ScrollView, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_URL from '../config';
import { fetchJson } from '../utils/api';

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
        total_products: 0, low_stock: 0, stock_out: 0, total_transactions: 0, today_sales: 0,
    });
    const [products,            setProducts]            = useState([]);
    const [lowStockProducts,    setLowStockProducts]    = useState([]);
    const [stockOutProducts,    setStockOutProducts]    = useState([]);
    const [recentTransactions,  setRecentTransactions]  = useState([]);
    const [searchQuery,         setSearchQuery]         = useState('');
    const [selectedProduct,     setSelectedProduct]     = useState(null);
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [adjustmentType,      setAdjustmentType]      = useState('in');
    const [adjustmentQty,       setAdjustmentQty]       = useState('');
    const [processingUpdate,    setProcessingUpdate]    = useState(false);
    const [drawerOpen,          setDrawerOpen]          = useState(false);

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const parseJsonResponse = async (response) => {
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}: ${text}`);
        }

        try {
            return JSON.parse(text);
        } catch (parseError) {
            throw new Error(`Invalid JSON response: ${text.slice(0, 240)}`);
        }
    };

    const loadDashboardData = useCallback(async () => {
        try {
            const [summaryData, productsData, lowStockData] = await Promise.all([
                fetchJson(`${API_URL}/api/mobile/daily-summary/`),
                fetchJson(`${API_URL}/api/mobile/products/`),
                fetchJson(`${API_URL}/api/mobile/low-stock/`),
            ]);

            let transactionsData = { success: false, transactions: [] };
            try {
                transactionsData = await fetchJson(`${API_URL}/api/mobile/transactions/`);
            } catch (transactionsError) {
                console.warn('Transactions endpoint unavailable:', transactionsError.message);
            }

            if (productsData.success) {
                const allProducts = productsData.products || [];
                setProducts(allProducts);
                setStats(prev => ({
                    ...prev,
                    total_products: allProducts.length,
                    stock_out: allProducts.filter(p => p.stock <= 0).length,
                }));
                setStockOutProducts(allProducts.filter(p => p.stock <= 0));
            }

            if (summaryData.success) {
                setStats(prev => ({
                    ...prev,
                    low_stock: summaryData.low_stock_alerts,
                    total_transactions: summaryData.total_transactions,
                    today_sales: summaryData.total_sales,
                }));
            }

            if (lowStockData.success) {
                setLowStockProducts(lowStockData.products || []);
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

    const openProductModal = (product) => {
        setSelectedProduct(product);
        setAdjustmentType('in');
        setAdjustmentQty('');
        setProductModalVisible(true);
    };

    const closeProductModal = () => {
        setProductModalVisible(false);
        setSelectedProduct(null);
        setAdjustmentQty('');
        setProcessingUpdate(false);
    };

    const handleStockAdjustment = async () => {
        if (!selectedProduct) return;
        const quantity = parseInt(adjustmentQty, 10);
        if (!quantity || quantity <= 0) {
            Alert.alert('Validation', 'Enter a valid quantity.');
            return;
        }

        const endpoint = adjustmentType === 'in'
            ? `${API_URL}/api/mobile/stock-in/add/`
            : `${API_URL}/api/mobile/stock-out/add/`;

        setProcessingUpdate(true);
        try {
            const data = await fetchJson(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.user_id,
                    product_id: selectedProduct.product_id,
                    quantity,
                    unit: selectedProduct.unit || 'pieces',
                    reason: adjustmentType === 'out' ? 'adjustment' : undefined,
                }),
            });

            if (data.success) {
                Alert.alert('Success', data.message || 'Stock updated successfully.');
                closeProductModal();
                setRefreshing(true);
                loadDashboardData();
            } else {
                Alert.alert('Error', data.message || 'Unable to update stock.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setProcessingUpdate(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 30000);
        return () => clearInterval(interval);
    }, [loadDashboardData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadDashboardData();
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

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

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                        }}>
                            <FontAwesome5 name="tachometer-alt" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Dashboard</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                            navigation.navigate('Inventory', { user });
                        }}>
                            <FontAwesome5 name="boxes" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Inventory</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                            navigation.navigate('StockIn', { user });
                        }}>
                            <FontAwesome5 name="arrow-circle-down" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stock In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                            navigation.navigate('StockOut', { user });
                        }}>
                            <FontAwesome5 name="arrow-circle-up" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stock Out</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                            navigation.navigate('StockInHistory', { user });
                        }}>
                            <FontAwesome5 name="history" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Stock In History</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.navItem} onPress={() => {
                            closeDrawer();
                            navigation.navigate('Users', { user });
                        }}>
                            <FontAwesome5 name="users" size={18} color={COLORS.white} />
                            <Text style={styles.navItemText}>Manage Users</Text>
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

            <Modal
                visible={productModalVisible}
                transparent
                animationType="slide"
                onRequestClose={closeProductModal}
            >
                <TouchableWithoutFeedback onPress={closeProductModal}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <View style={styles.productModalContainer}>
                    <View style={styles.productModalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Product Details</Text>
                            <TouchableOpacity onPress={closeProductModal}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedProduct ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Product</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.name}</Text>
                                </View>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Category</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.category || 'Uncategorized'}</Text>
                                </View>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Current Stock</Text>
                                    <Text style={[styles.modalValue, selectedProduct.stock <= 0 && { color: COLORS.danger }]}> {selectedProduct.stock} {selectedProduct.unit || ''}</Text>
                                </View>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Reorder Level</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.reorder_level || 0}</Text>
                                </View>
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Status</Text>
                                    <Text style={[styles.statusBadge, selectedProduct.stock <= 0 ? styles.statusOut : selectedProduct.stock <= (selectedProduct.reorder_level || 10) ? styles.statusLow : styles.statusOk]}>
                                        {selectedProduct.stock <= 0 ? 'Out of stock' : selectedProduct.stock <= (selectedProduct.reorder_level || 10) ? 'Low stock' : 'In stock'}
                                    </Text>
                                </View>

                                <Text style={styles.sectionTitle}>Adjust Stock</Text>
                                <View style={styles.adjustmentRow}>
                                    <TouchableOpacity
                                        style={[styles.adjustButton, adjustmentType === 'in' && styles.adjustButtonActive]}
                                        onPress={() => setAdjustmentType('in')}
                                    >
                                        <Text style={[styles.adjustButtonText, adjustmentType === 'in' && styles.adjustButtonTextActive]}>Stock In</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.adjustButton, adjustmentType === 'out' && styles.adjustButtonActive]}
                                        onPress={() => setAdjustmentType('out')}
                                    >
                                        <Text style={[styles.adjustButtonText, adjustmentType === 'out' && styles.adjustButtonTextActive]}>Stock Out</Text>
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.adjustInput}
                                    placeholder="Enter quantity"
                                    placeholderTextColor={COLORS.textMuted}
                                    keyboardType="numeric"
                                    value={adjustmentQty}
                                    onChangeText={setAdjustmentQty}
                                />
                                <TouchableOpacity
                                    style={[styles.primaryButton, processingUpdate && { opacity: 0.7 }]}
                                    onPress={handleStockAdjustment}
                                    disabled={processingUpdate}
                                >
                                    <Text style={styles.primaryButtonText}>{processingUpdate ? 'Updating...' : 'Apply Update'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

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

                {/* Alerts banner */}
                {(lowStockProducts.length > 0 || stockOutProducts.length > 0) && (
                    <View style={styles.alertBanner}>
                        <FontAwesome5 name="bell" size={14} color={COLORS.white} />
                        <Text style={styles.alertBannerText}>
                            {lowStockProducts.length} low-stock item{lowStockProducts.length === 1 ? '' : 's'} and {stockOutProducts.length} out-of-stock product{stockOutProducts.length === 1 ? '' : 's'} detected.
                        </Text>
                    </View>
                )}

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
                            <FontAwesome5 name="times-circle" size={22} color={COLORS.danger} />
                        </View>
                        <Text style={[styles.statNumber, stats.stock_out > 0 && { color: COLORS.danger }]}>
                            {stats.stock_out}
                        </Text>
                        <Text style={styles.statLabel}>Stock Out</Text>
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

                {/* Inventory List */}
                <View style={styles.inventorySection}>
                    <View style={styles.sectionHeader}>
                        <FontAwesome5 name="boxes" size={16} color={COLORS.text} />
                        <Text style={styles.sectionTitle}>Inventory</Text>
                    </View>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products or categories"
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {filteredProducts.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No matching products found.</Text>
                        </View>
                    ) : (
                        filteredProducts.slice(0, 12).map(product => (
                            <TouchableOpacity key={product.product_id} style={styles.productRow} onPress={() => openProductModal(product)}>
                                <View style={styles.productMeta}>
                                    <Text style={styles.productName}>{product.name}</Text>
                                    <Text style={styles.productCategory}>{product.category || 'General'}</Text>
                                </View>
                                <View style={styles.productDetailGroup}>
                                    <Text style={styles.productStock}>{product.stock} {product.unit || ''}</Text>
                                    <Text style={[styles.productStatus, product.stock <= 0 ? styles.statusOut : product.stock <= (product.reorder_level || 10) ? styles.statusLow : styles.statusOk]}>
                                        {product.stock <= 0 ? 'Out' : product.stock <= (product.reorder_level || 10) ? 'Low' : 'OK'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
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

                {stockOutProducts.length > 0 && (
                    <View style={styles.alertSection}>
                        <View style={styles.sectionHeader}>
                            <FontAwesome5 name="times-circle" size={16} color={COLORS.danger} />
                            <Text style={styles.sectionTitle}>Out of Stock</Text>
                        </View>
                        {stockOutProducts.map(product => (
                            <View key={product.product_id} style={styles.alertItem}>
                                <View style={styles.alertIcon}>
                                    <FontAwesome5 name="times" size={14} color={COLORS.white} />
                                </View>
                                <View style={styles.alertInfo}>
                                    <Text style={styles.alertName}>{product.name}</Text>
                                    <Text style={styles.alertStock}>Restock immediately</Text>
                                </View>
                                <View style={[styles.restockBtn, { backgroundColor: COLORS.danger }]}> 
                                    <Text style={[styles.restockBtnText, { color: COLORS.white }]}>Out</Text>
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

    inventorySection: {
        backgroundColor: COLORS.white,
        marginHorizontal: 12,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
    },
    searchInput: {
        backgroundColor: COLORS.bg,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: COLORS.text,
        marginBottom: 14,
    },
    productRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    productMeta: { flex: 1, paddingRight: 10 },
    productName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    productCategory: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    productDetailGroup: { alignItems: 'flex-end' },
    productStock: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    productStatus: {
        marginTop: 4,
        fontSize: 11,
        fontWeight: '700',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 10,
        overflow: 'hidden',
    },
    statusOk: { color: COLORS.success, backgroundColor: '#e6f7ed' },
    statusLow: { color: COLORS.warning, backgroundColor: '#fff4e5' },
    statusOut: { color: COLORS.danger, backgroundColor: '#fdecea' },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.danger,
        marginHorizontal: 12,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    alertBannerText: { color: COLORS.white, marginLeft: 8, fontSize: 13, flex: 1 },
    productModalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
    productModalSheet: {
        margin: 20,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        padding: 20,
        maxHeight: '85%',
        elevation: 6,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    modalInfoRow: { marginBottom: 12 },
    modalLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
    modalValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
    statusBadge: {
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },
    adjustmentRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    adjustButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: COLORS.border,
        alignItems: 'center',
    },
    adjustButtonActive: { backgroundColor: COLORS.primary },
    adjustButtonText: { color: COLORS.textMuted, fontWeight: '700' },
    adjustButtonTextActive: { color: COLORS.white },
    adjustInput: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: COLORS.text,
        marginBottom: 12,
        backgroundColor: '#fbfbfb',
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 8,
    },
    primaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

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
