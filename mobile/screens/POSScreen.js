import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, TextInput,
    ScrollView, Modal, RefreshControl
} from 'react-native';
import { colors, globalStyles } from '../styles/GlobalStyles';
import API_URL from '../config';

export default function POSScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [products, setProducts]     = useState([]);
    const [cart, setCart]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch]         = useState('');
    const [category, setCategory]     = useState('all');
    const [amountReceived, setAmountReceived] = useState('');
    const [checkoutModal, setCheckoutModal]   = useState(false);
    const [checkingOut, setCheckingOut]       = useState(false);

    const categories = ['all', 'Rice & Grains', 'Oils & Cooking', 'Dairy & Eggs', 'Beverages', 'Canned Goods', 'Bakery'];

    // ── LOAD PRODUCTS ──────────────────────────────────
    const loadProducts = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/mobile/products/`);
            const data = await res.json();
            if (data.success) setProducts(data.products || []);
        } catch (err) {
            Alert.alert('Error', 'Failed to load products.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadProducts(); }, []);

    const onRefresh = () => { setRefreshing(true); loadProducts(); };

    // ── FILTER PRODUCTS ────────────────────────────────
    const filteredProducts = products.filter(p =>
        p.stock > 0 &&
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (category === 'all' || p.category === category)
    );

    // ── CART FUNCTIONS ─────────────────────────────────
    const addToCart = (product) => {
        const existing = cart.find(i => i.product_id === product.product_id);
        if (existing) {
            if (existing.qty >= product.stock) {
                Alert.alert('Stock Limit', `Only ${product.stock} left in stock.`);
                return;
            }
            setCart(cart.map(i =>
                i.product_id === product.product_id ? { ...i, qty: i.qty + 1 } : i
            ));
        } else {
            setCart([...cart, { ...product, qty: 1 }]);
        }
    };

    const removeFromCart = (product_id) => {
        setCart(cart.filter(i => i.product_id !== product_id));
    };

    const updateQty = (product_id, qty) => {
        const num = parseInt(qty);
        if (isNaN(num) || num < 1) { removeFromCart(product_id); return; }
        const product = products.find(p => p.product_id === product_id);
        if (num > product.stock) {
            Alert.alert('Stock Limit', `Only ${product.stock} left in stock.`);
            return;
        }
        setCart(cart.map(i => i.product_id === product_id ? { ...i, qty: num } : i));
    };

    const clearCart = () => {
        Alert.alert('Clear Cart', 'Remove all items from cart?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setCart([]) },
        ]);
    };

    // ── TOTALS ─────────────────────────────────────────
    const subtotal = cart.reduce((sum, i) => sum + parseFloat(i.price) * i.qty, 0);
    const tax      = subtotal * 0.12;
    const total    = subtotal + tax;
    const change   = parseFloat(amountReceived || 0) - total;

    // ── CHECKOUT ───────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) { Alert.alert('Empty Cart', 'Add items first.'); return; }
        const received = parseFloat(amountReceived || 0);
        if (received < total) { Alert.alert('Insufficient Payment', `Total is ₱${total.toFixed(2)}`); return; }
        setCheckingOut(true);
        try {
            const res = await fetch(`${API_URL}/api/mobile/checkout/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.user_id,
                    items: cart.map(i => ({
                        product_id: i.product_id,
                        quantity: i.qty,
                        price: i.price,
                    })),
                    total: total,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setCheckoutModal(false);
                Alert.alert(
                    'Sale Complete!',
                    `Total: ₱${total.toFixed(2)}\nChange: ₱${change.toFixed(2)}`,
                    [{ text: 'OK', onPress: () => { setCart([]); setAmountReceived(''); loadProducts(); } }]
                );
            } else {
                Alert.alert('Checkout Failed', data.message || 'Something went wrong.');
            }
        } catch (err) {
            Alert.alert('Error', 'Cannot reach server: ' + err.message);
        } finally {
            setCheckingOut(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: () => navigation.replace('Login') },
        ]);
    };

    if (loading) {
        return (
            <View style={globalStyles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[globalStyles.subtext, { marginTop: 12 }]}>Loading products...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Point of Sale</Text>
                    <Text style={styles.headerSub}>{user?.username}</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.body}>

                {/* LEFT — Products */}
                <View style={styles.leftPanel}>

                    {/* Search */}
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        placeholderTextColor={colors.muted}
                        value={search}
                        onChangeText={setSearch}
                    />

                    {/* Category Filter */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                    >
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                                onPress={() => setCategory(cat)}
                            >
                                <Text style={[styles.catText, category === cat && styles.catTextActive]}>
                                    {cat === 'all' ? 'All' : cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Product Grid */}
                    <FlatList
                        data={filteredProducts}
                        keyExtractor={item => item.product_id}
                        numColumns={2}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
                        }
                        columnWrapperStyle={styles.productRow}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.productCard}
                                onPress={() => addToCart(item)}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.productPrice}>₱{parseFloat(item.price).toFixed(2)}</Text>
                                <Text style={styles.productStock}>Stock: {item.stock}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No products found.</Text>
                        }
                    />
                </View>

                {/* RIGHT — Cart */}
                <View style={styles.rightPanel}>
                    <View style={styles.cartHeader}>
                        <Text style={styles.cartTitle}>Current Sale</Text>
                        {cart.length > 0 && (
                            <TouchableOpacity onPress={clearCart}>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Cart Items */}
                    <ScrollView style={styles.cartItems}>
                        {cart.length === 0
                            ? <Text style={styles.emptyCart}>No items yet.{'\n'}Tap a product to add.</Text>
                            : cart.map((item, i) => (
                                <View key={item.product_id} style={styles.cartItem}>
                                    <View style={styles.cartItemTop}>
                                        <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                                        <TouchableOpacity onPress={() => removeFromCart(item.product_id)}>
                                            <Text style={styles.removeBtn}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.cartItemBottom}>
                                        <View style={styles.qtyControl}>
                                            <TouchableOpacity
                                                style={styles.qtyBtn}
                                                onPress={() => updateQty(item.product_id, item.qty - 1)}
                                            >
                                                <Text style={styles.qtyBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qtyText}>{item.qty}</Text>
                                            <TouchableOpacity
                                                style={styles.qtyBtn}
                                                onPress={() => updateQty(item.product_id, item.qty + 1)}
                                            >
                                                <Text style={styles.qtyBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <Text style={styles.cartItemTotal}>
                                            ₱{(parseFloat(item.price) * item.qty).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        }
                    </ScrollView>

                    {/* Summary */}
                    <View style={styles.summary}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>₱{subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Tax (12%)</Text>
                            <Text style={styles.summaryValue}>₱{tax.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>₱{total.toFixed(2)}</Text>
                        </View>

                        <TouchableOpacity
                            style={[globalStyles.btn, cart.length === 0 && globalStyles.btnDisabled]}
                            onPress={() => setCheckoutModal(true)}
                            disabled={cart.length === 0}
                            activeOpacity={0.85}
                        >
                            <Text style={globalStyles.btnText}>Complete Sale</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Checkout Modal */}
            <Modal
                visible={checkoutModal}
                transparent
                animationType="slide"
                onRequestClose={() => setCheckoutModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Complete Sale</Text>

                        <View style={styles.modalSummary}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal</Text>
                                <Text style={styles.summaryValue}>₱{subtotal.toFixed(2)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Tax (12%)</Text>
                                <Text style={styles.summaryValue}>₱{tax.toFixed(2)}</Text>
                            </View>
                            <View style={[styles.summaryRow, styles.totalRow]}>
                                <Text style={styles.totalLabel}>Total</Text>
                                <Text style={styles.totalValue}>₱{total.toFixed(2)}</Text>
                            </View>
                        </View>

                        <Text style={styles.modalLabel}>Amount Received</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="0.00"
                            placeholderTextColor={colors.muted}
                            keyboardType="numeric"
                            value={amountReceived}
                            onChangeText={setAmountReceived}
                        />

                        <View style={[styles.changeBox, change >= 0 ? styles.changePositive : styles.changeNegative]}>
                            <Text style={styles.changeLabel}>Change</Text>
                            <Text style={styles.changeValue}>
                                ₱{isNaN(change) ? '0.00' : change.toFixed(2)}
                            </Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setCheckoutModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[globalStyles.btn, { flex: 1 }, checkingOut && globalStyles.btnDisabled]}
                                onPress={handleCheckout}
                                disabled={checkingOut}
                                activeOpacity={0.85}
                            >
                                {checkingOut
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={globalStyles.btnText}>Confirm</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
        backgroundColor: colors.primary,
        padding: 16,
        paddingTop: 50,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    logoutBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
    },
    logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    // Body
    body: { flex: 1, flexDirection: 'row' },

    // Left Panel — Products
    leftPanel: { flex: 1.2, borderRightWidth: 1, borderRightColor: '#e8f0ea', padding: 10 },

    searchInput: {
        borderWidth: 1.5, borderColor: colors.border,
        borderRadius: 10, padding: 10,
        fontSize: 14, color: colors.dark,
        backgroundColor: colors.white,
        marginBottom: 8,
    },

    categoryScroll: { marginBottom: 8, maxHeight: 36 },
    catBtn: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, backgroundColor: '#e8f0ea',
        marginRight: 6, height: 32,
    },
    catBtnActive: { backgroundColor: colors.primary },
    catText:       { fontSize: 12, color: colors.muted, fontWeight: '600' },
    catTextActive: { color: '#fff' },

    productRow: { justifyContent: 'space-between', marginBottom: 8 },
    productCard: {
        backgroundColor: colors.white,
        borderRadius: 12, padding: 12,
        width: '48%',
        borderWidth: 1.5, borderColor: colors.border,
        shadowColor: '#000', shadowOpacity: 0.04,
        shadowRadius: 4, elevation: 1,
    },
    productName:  { fontSize: 13, fontWeight: '600', color: colors.dark, marginBottom: 6 },
    productPrice: { fontSize: 15, fontWeight: '800', color: colors.primary, marginBottom: 2 },
    productStock: { fontSize: 11, color: colors.muted },
    emptyText:    { textAlign: 'center', color: colors.muted, padding: 30, fontSize: 14 },

    // Right Panel — Cart
    rightPanel: {
        flex: 1, padding: 10,
        backgroundColor: colors.white,
    },
    cartHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
    },
    cartTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
    clearText:  { fontSize: 13, color: colors.error, fontWeight: '600' },

    cartItems: { flex: 1 },
    emptyCart: { textAlign: 'center', color: colors.muted, paddingTop: 30, fontSize: 13, lineHeight: 22 },

    cartItem: {
        backgroundColor: '#f8fffe',
        borderRadius: 10, padding: 10,
        marginBottom: 8, borderWidth: 1,
        borderColor: colors.border,
    },
    cartItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    cartItemName: { fontSize: 13, fontWeight: '600', color: colors.dark, flex: 1, marginRight: 6 },
    removeBtn:    { fontSize: 14, color: colors.error, fontWeight: '700' },
    cartItemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    qtyBtn: {
        backgroundColor: colors.border,
        width: 28, height: 28,
        borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.dark },
    qtyText:    { fontSize: 15, fontWeight: '700', color: colors.dark, minWidth: 24, textAlign: 'center' },
    cartItemTotal: { fontSize: 14, fontWeight: '700', color: colors.primary },

    // Summary
    summary: {
        borderTopWidth: 1, borderTopColor: '#e8f0ea',
        paddingTop: 10, marginTop: 4,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    summaryLabel: { fontSize: 13, color: colors.muted },
    summaryValue: { fontSize: 13, color: colors.dark, fontWeight: '600' },
    totalRow:   { marginTop: 4, marginBottom: 12 },
    totalLabel: { fontSize: 16, fontWeight: '700', color: colors.dark },
    totalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.dark, marginBottom: 16 },
    modalSummary: {
        backgroundColor: '#f8fffe',
        borderRadius: 12, padding: 14,
        marginBottom: 16,
        borderWidth: 1, borderColor: colors.border,
    },
    modalLabel: { fontSize: 13, fontWeight: '600', color: colors.dark, marginBottom: 8 },
    modalInput: {
        borderWidth: 1.5, borderColor: colors.border,
        borderRadius: 10, padding: 14,
        fontSize: 18, color: colors.dark,
        backgroundColor: colors.background,
        marginBottom: 12,
    },
    changeBox: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', padding: 14,
        borderRadius: 10, marginBottom: 16,
    },
    changePositive: { backgroundColor: '#d4edda' },
    changeNegative: { backgroundColor: '#f8d7da' },
    changeLabel: { fontSize: 14, fontWeight: '600', color: colors.dark },
    changeValue: { fontSize: 18, fontWeight: '800', color: colors.dark },

    modalActions: { flexDirection: 'row', gap: 10 },
    modalCancelBtn: {
        flex: 1, backgroundColor: '#f1f1f1',
        borderRadius: 10, padding: 14, alignItems: 'center',
    },
    modalCancelText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});