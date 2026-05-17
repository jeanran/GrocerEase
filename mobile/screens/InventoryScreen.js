import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_URL from '../config';
import { fetchJson } from '../utils/api';

const C = {
    primary:      '#1e6f5c',
    primaryDark:  '#0e5545',
    primaryLight: '#e8f5f1',
    dark:         '#2c3e50',
    gray:         '#95a5a6',
    light:        '#e9ecef',
    white:        '#ffffff',
    danger:       '#e74c3c',
    warning:      '#f39c12',
    success:      '#27ae60',
    bg:           '#f0f2f5',
    border:       '#e9ecef',
    text:         '#2c3e50',
    textMuted:    '#95a5a6',
    sidebar:      '#1e2d3d',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);

export default function InventoryScreen({ navigation, route }) {
    const { user } = route.params || {};
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [adjustmentType, setAdjustmentType] = useState('in');
    const [adjustmentQty, setAdjustmentQty] = useState('');
    const [processingUpdate, setProcessingUpdate] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const loadProducts = useCallback(async () => {
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/products/`);
            if (data.success) {
                setProducts(data.products || []);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to load inventory: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const onRefresh = () => {
        setRefreshing(true);
        loadProducts();
    };

    const openProductModal = (product) => {
        setSelectedProduct(product);
        setAdjustmentType('in');
        setAdjustmentQty('');
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
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
                body: JSON.stringify({
                    user_id: user?.user_id,
                    product_id: selectedProduct.product_id,
                    quantity,
                    unit: selectedProduct.unit || 'pieces',
                    reason: adjustmentType === 'out' ? 'adjustment' : undefined,
                }),
            });

            if (data.success) {
                Alert.alert('Success', `Stock ${adjustmentType === 'in' ? 'added' : 'removed'} successfully!`);
                closeModal();
                loadProducts();
            } else {
                Alert.alert('Error', data.message || 'Unable to update stock.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setProcessingUpdate(false);
        }
    };

    const handleLogout = () => {
        closeDrawer();
        navigation.replace('Login');
    };

    const filteredProducts = products.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());

        if (filterType === 'low-stock') {
            return matchesSearch && p.stock <= p.reorder_level && p.stock > 0;
        } else if (filterType === 'out-of-stock') {
            return matchesSearch && p.stock <= 0;
        }
        return matchesSearch;
    });

    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.reorder_level || 10)).length;
    const outOfStockCount = products.filter(p => p.stock <= 0).length;

    const getStockStatus = (product) => {
        if (product.stock <= 0) {
            return { label: 'Out', color: C.danger, icon: 'times-circle', bg: '#fdecea' };
        } else if (product.stock <= (product.reorder_level || 10)) {
            return { label: 'Low', color: C.warning, icon: 'exclamation-triangle', bg: '#fff3cd' };
        }
        return { label: 'OK', color: C.success, icon: 'check-circle', bg: '#d4edda' };
    };

    const renderProductItem = ({ item }) => {
        const status = getStockStatus(item);
        return (
            <TouchableOpacity onPress={() => openProductModal(item)} style={styles.productCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.productIcon}>
                        <FontAwesome5 name="box" size={14} color={C.primary} />
                    </View>
                    <View style={styles.productInfo}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text style={styles.productCategory}>
                            {item.category || 'Uncategorized'} • {item.unit || 'pieces'}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <FontAwesome5 name={status.icon} size={10} color={status.color} />
                        <Text style={[styles.statusLabel, { color: status.color }]}>
                            {status.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name="cubes" size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Stock:</Text>
                        <Text style={[styles.detailValue, { color: status.color, fontWeight: '700' }]}>
                            {item.stock} {item.unit || ''}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name="exclamation-triangle" size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Reorder:</Text>
                        <Text style={styles.detailValue}>{item.reorder_level || 10}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name="money-bill-wave" size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Price:</Text>
                        <Text style={styles.detailValue}>
                            ₱{typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}
                        </Text>
                    </View>
                </View>

                <View style={styles.stockBar}>
                    <View
                        style={[
                            styles.stockBarFill,
                            {
                                width: `${Math.min(
                                    (item.stock / ((item.reorder_level || 10) * 2 || 1)) * 100,
                                    100
                                )}%`,
                                backgroundColor: status.color,
                            },
                        ]}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.root}>
                <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.primary} />

            {/* DRAWER */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={styles.backdrop} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerX }] }]}>
                        <View style={styles.drawerLogo}>
                            <View style={styles.drawerLogoIcon}>
                                <FontAwesome5 name="store" size={18} color={C.white} />
                            </View>
                            <Text style={styles.drawerLogoText}>
                                Grocer<Text style={{ color: C.warning }}>Ease</Text>
                            </Text>
                        </View>

                        {[
                            { icon: 'tachometer-alt', label: 'Dashboard', onPress: () => { closeDrawer(); navigation.navigate('AdminDashboard', { user }); } },
                            { icon: 'boxes', label: 'Stocks', onPress: () => { closeDrawer(); navigation.navigate('Stocks', { user }); } },
                            { icon: 'boxes', label: 'Inventory', onPress: closeDrawer },
                            { icon: 'arrow-circle-down', label: 'Stock In', onPress: () => { closeDrawer(); navigation.navigate('StockIn', { user }); } },
                            { icon: 'arrow-circle-up', label: 'Stock Out', onPress: () => { closeDrawer(); navigation.navigate('StockOut', { user }); } },
                            { icon: 'history', label: 'Stock In History', onPress: () => { closeDrawer(); navigation.navigate('StockInHistory', { user }); } },
                            { icon: 'users', label: 'Manage Users', onPress: () => { closeDrawer(); navigation.navigate('Users', { user }); } },
                        ].map((item, idx) => (
                            <TouchableOpacity key={idx} style={styles.navItem} onPress={item.onPress}>
                                <FontAwesome5 name={item.icon} size={15} color={C.white} />
                                <Text style={styles.navItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={C.danger} />
                            <Text style={styles.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}

            {/* NAVBAR */}
            <View style={styles.navbar}>
                <TouchableOpacity onPress={openDrawer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="menu" size={26} color={C.white} />
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <FontAwesome5 name="store" size={14} color={C.white} style={{ marginRight: 6 }} />
                    <Text style={styles.navTitle}>GrocerEase</Text>
                </View>
                <View style={styles.navUser}>
                    <FontAwesome5 name="user-circle" size={16} color={C.white} />
                    <Text style={styles.navUsername}>{user?.username || 'Admin'}</Text>
                </View>
            </View>

            {/* MAIN CONTENT */}
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                
                {/* Page Header */}
                <View style={styles.pageHeader}>
                    <View style={styles.pageTitle}>
                        <FontAwesome5 name="boxes" size={18} color={C.dark} style={{ marginRight: 10 }} />
                        <Text style={styles.pageTitleText}>Inventory</Text>
                    </View>
                </View>

                {/* Summary Cards - 2x2 Grid */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="boxes" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Products</Text>
                            <Text style={styles.summaryValue}>{totalProducts}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="exclamation-triangle" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Low Stock</Text>
                            <Text style={[styles.summaryValue, { color: lowStockCount > 0 ? C.warning : C.dark }]}>{lowStockCount}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="times-circle" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Out of Stock</Text>
                            <Text style={[styles.summaryValue, { color: outOfStockCount > 0 ? C.danger : C.dark }]}>{outOfStockCount}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="cubes" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Categories</Text>
                            <Text style={styles.summaryValue}>
                                {new Set(products.map(p => p.category).filter(Boolean)).size}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <FontAwesome5 name="search" size={14} color={C.gray} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or category..."
                        placeholderTextColor={C.gray}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={C.gray} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Buttons */}
                <View style={styles.filterBar}>
                    {[
                        { key: 'all', label: 'All', icon: 'boxes' },
                        { key: 'low-stock', label: 'Low Stock', icon: 'exclamation-triangle' },
                        { key: 'out-of-stock', label: 'Out', icon: 'times-circle' },
                    ].map((filter) => (
                        <TouchableOpacity
                            key={filter.key}
                            style={[
                                styles.filterButton,
                                filterType === filter.key && styles.filterButtonActive,
                            ]}
                            onPress={() => setFilterType(filter.key)}
                        >
                            <FontAwesome5
                                name={filter.icon}
                                size={11}
                                color={filterType === filter.key ? C.white : C.text}
                            />
                            <Text
                                style={[
                                    styles.filterButtonText,
                                    filterType === filter.key && styles.filterButtonTextActive,
                                ]}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Products List */}
                {filteredProducts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome5 name="inbox" size={48} color={C.light} />
                        <Text style={styles.emptyText}>No products found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={(item) => item.product_id.toString()}
                        renderItem={renderProductItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl 
                                refreshing={refreshing} 
                                onRefresh={onRefresh}
                                colors={[C.primary]}
                                tintColor={C.primary}
                            />
                        }
                        scrollEnabled={false}
                    />
                )}
            </ScrollView>

            {/* Product Adjustment Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <View style={styles.modalContainer}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Product Details</Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color={C.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedProduct && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Product</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.name}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Category</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.category || 'Uncategorized'}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Unit</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.unit || 'pieces'}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Current Stock</Text>
                                    <Text style={[styles.modalValue, selectedProduct.stock <= 0 && { color: C.danger }]}>
                                        {selectedProduct.stock} {selectedProduct.unit || ''}
                                    </Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Reorder Level</Text>
                                    <Text style={styles.modalValue}>{selectedProduct.reorder_level || 10}</Text>
                                </View>
                                <View style={styles.modalRow}>
                                    <Text style={styles.modalLabel}>Price</Text>
                                    <Text style={styles.modalValue}>₱{parseFloat(selectedProduct.price || 0).toFixed(2)}</Text>
                                </View>
                                <View style={styles.modalDivider} />

                                <Text style={styles.adjustTitle}>Adjust Stock</Text>
                                <View style={styles.adjustRow}>
                                    {['in', 'out'].map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            style={[styles.adjustBtn, adjustmentType === type && styles.adjustBtnActive]}
                                            onPress={() => setAdjustmentType(type)}
                                        >
                                            <FontAwesome5
                                                name={type === 'in' ? 'arrow-circle-down' : 'arrow-circle-up'}
                                                size={14}
                                                color={adjustmentType === type ? C.white : C.gray}
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text style={[styles.adjustBtnText, adjustmentType === type && styles.adjustBtnTextActive]}>
                                                Stock {type === 'in' ? 'In' : 'Out'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput
                                    style={styles.adjustInput}
                                    placeholder="Enter quantity"
                                    placeholderTextColor={C.gray}
                                    keyboardType="numeric"
                                    value={adjustmentQty}
                                    onChangeText={setAdjustmentQty}
                                />
                                <TouchableOpacity
                                    style={[styles.applyBtn, processingUpdate && { opacity: 0.7 }]}
                                    onPress={handleStockAdjustment}
                                    disabled={processingUpdate}
                                >
                                    <Text style={styles.applyBtnText}>{processingUpdate ? 'Updating...' : 'Apply Update'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },

    // Drawer
    drawer: {
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: DRAWER_W, backgroundColor: C.sidebar,
        paddingTop: 56, zIndex: 99, elevation: 6,
    },
    drawerLogo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
    drawerLogoIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    drawerLogoText: { fontSize: 20, fontWeight: '800', color: C.white },
    navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 12, borderRadius: 10, marginBottom: 6 },
    navItemText: { color: C.white, fontSize: 14, fontWeight: '500' },
    drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, marginTop: 16, marginHorizontal: 12 },
    drawerLogoutText: { color: C.danger, fontSize: 14, fontWeight: '600' },

    // Navbar
    navbar: { backgroundColor: C.primary, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4 },
    navCenter: { flexDirection: 'row', alignItems: 'center' },
    navTitle: { fontSize: 18, fontWeight: '800', color: C.white },
    navUser: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navUsername: { color: C.white, fontSize: 12, fontWeight: '600' },

    // Main Container
    container: { flex: 1, padding: 16 },

    // Page Header
    pageHeader: { marginBottom: 16 },
    pageTitle: { flexDirection: 'row', alignItems: 'center' },
    pageTitleText: { fontSize: 20, fontWeight: '700', color: C.dark },

    // Summary Cards - 2x2 Grid
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    summaryCard: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: C.white,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderLeftWidth: 4,
        borderLeftColor: C.primary,
        elevation: 2,
    },
    summaryIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    summaryInfo: { flex: 1 },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: C.gray, textTransform: 'uppercase', letterSpacing: 0.4 },
    summaryValue: { fontSize: 18, fontWeight: '800', color: C.dark, marginTop: 4 },

    // Search Bar
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        gap: 10,
    },
    searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

    // Filter Bar
    filterBar: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: C.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
        gap: 6,
    },
    filterButtonActive: { backgroundColor: C.primary, borderColor: C.primary },
    filterButtonText: { fontSize: 12, fontWeight: '600', color: C.text },
    filterButtonTextActive: { color: C.white },

    // Product Cards
    listContent: { paddingBottom: 20 },
    productCard: {
        backgroundColor: C.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    productIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
    productInfo: { flex: 1 },
    productName: { fontSize: 15, fontWeight: '700', color: C.text },
    productCategory: { fontSize: 11, color: C.gray, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    statusLabel: { fontSize: 10, fontWeight: '600' },
    cardDetails: { gap: 8, marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { fontSize: 12, color: C.gray, width: 55 },
    detailValue: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
    stockBar: { height: 6, backgroundColor: C.light, borderRadius: 3, overflow: 'hidden' },
    stockBarFill: { height: '100%', borderRadius: 3 },

    // Empty State
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 14, color: C.gray },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: C.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
        elevation: 10,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    modalRow: { marginBottom: 12 },
    modalLabel: { fontSize: 11, color: C.gray, marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
    modalValue: { fontSize: 15, color: C.text, fontWeight: '600' },
    modalDivider: { height: 1, backgroundColor: C.light, marginVertical: 16 },
    adjustTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 },
    adjustRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    adjustBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: C.bg,
        borderWidth: 1,
        borderColor: C.border,
    },
    adjustBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    adjustBtnText: { fontSize: 13, fontWeight: '600', color: C.gray },
    adjustBtnTextActive: { color: C.white },
    adjustInput: {
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: C.text,
        marginBottom: 12,
        backgroundColor: C.white,
    },
    applyBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
    applyBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
});