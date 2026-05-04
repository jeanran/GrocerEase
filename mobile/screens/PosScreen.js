import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert,
    ScrollView, StatusBar, Modal,
    Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';   // ← NEW
import { colors, globalStyles } from '../styles/GlobalStyles';
import API_URL from '../config';

const C = {
    sidebar:      '#1e2d3d',
    primary:      '#1e6f5c',
    primaryLight: '#e8f5f1',
    accent:       '#29c98f',
    danger:       '#e17055',
    bg:           '#f0f2f5',
    white:        '#ffffff',
    border:       '#e2e8f0',
    text:         '#2d3436',
    muted:        '#718096',
    receiptBg:    '#fafaf8',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);
const CARD_PAD = 16;
const GRID_GAP  = 12;
const HALF_W    = (SCREEN_W - CARD_PAD * 2 - CARD_PAD * 2 - GRID_GAP) / 2;

export default function POSScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [products, setProducts]                 = useState([]);
    const [cart, setCart]                         = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [checkoutLoading, setCheckoutLoading]   = useState(false);
    const [searchQuery, setSearchQuery]           = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [amountReceived, setAmountReceived]     = useState('');
    const [drawerOpen, setDrawerOpen]             = useState(false);
    const [receiptVisible, setReceiptVisible]     = useState(false);
    const [lastReceipt, setLastReceipt]           = useState(null);

    // ── Barcode scanner state ─────────────────────────────────────────────────
    const [scannerVisible, setScannerVisible]     = useState(false);   // ← NEW
    const [permission, requestPermission]         = useCameraPermissions(); // ← NEW
    const [scanned, setScanned]                   = useState(false);   // ← NEW

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };
    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    // ── Load products ────────────────────────────────────────────────────────
    const loadProducts = useCallback(async () => {
    try {
        const url = `${API_URL}/api/mobile/products/`;
        console.log('Fetching from:', url);  // ← ADD THIS
        const res  = await fetch(url);
        const raw  = await res.text();
        console.log('Raw response:', raw.substring(0, 300));  // ← AND THIS
        const data = JSON.parse(raw);
        if (data.success) setProducts(data.products || []);
    } catch (err) {
        Alert.alert('Error', err.message);
    } finally {
        setLoading(false);
    
    }
}, []);

useEffect(() => {
    loadProducts();
}, []);

    // ── Cart helpers ─────────────────────────────────────────────────────────
    const addToCart = (product) => {
        const existing = cart.find(i => i.product_id === product.product_id);
        if (existing) {
            if (existing.quantity >= product.stock) {
                Alert.alert('Out of stock', 'Not enough stock available.');
                return;
            }
            setCart(cart.map(i =>
                i.product_id === product.product_id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const updateQty = (product_id, delta) => {
        setCart(prev => {
            const item = prev.find(i => i.product_id === product_id);
            if (!item) return prev;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return prev.filter(i => i.product_id !== product_id);
            if (newQty > item.stock) {
                Alert.alert('Out of stock', 'Not enough stock available.');
                return prev;
            }
            return prev.map(i => i.product_id === product_id ? { ...i, quantity: newQty } : i);
        });
    };

    const getSubtotal = () => cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
    const getTax      = () => getSubtotal() * 0.12;
    const getTotal    = () => getSubtotal() + getTax();
    const getChange   = () => (parseFloat(amountReceived) || 0) - getTotal();

    // ── Barcode scan handler ─────────────────────────────────────────────────
const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    setScannerVisible(false);

    // 🔍 TEMPORARY DEBUG — remove after fixing
    const debugInfo = products.map(p => 
        `${p.name}: [${JSON.stringify(p.barcode)}]`
    ).join('\n');

    Alert.alert(
        'Debug Info',
        `Camera read: [${data}]\nLength: ${data.length}\n\nProducts:\n${debugInfo}`
    );

    console.log('Camera read:', JSON.stringify(data));
    console.log('Available products:', products.length);

    products.forEach(p => {
        console.log(`Product: "${p.name}" | barcode: ${JSON.stringify(p.barcode)}`);
    });

    // ✅ KEEP THIS ONE ONLY
    const product = products.find(p => {
        const cleanProduct = p.barcode
            ? String(p.barcode).replace(/\D/g, '').replace(/^0+/, '')
            : '';

        const cleanScanned = String(data)
            .replace(/\D/g, '')
            .replace(/^0+/, '');

        console.log('Comparing:', cleanProduct, cleanScanned);

        return cleanProduct === cleanScanned;
    });

    if (product) {
        console.log('Product found:', product.name);
        addToCart(product);
        Alert.alert('Added!', `${product.name} added to cart.`);
    } else {
        console.log(
            'No product found. First few barcodes:',
            products.slice(0, 5).map(p => ({ name: p.name, barcode: p.barcode }))
        );
        Alert.alert('Not Found', `No product found for barcode:\n${data}`);
    }

    setTimeout(() => setScanned(false), 2000);
};
    // ── Checkout ─────────────────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) { Alert.alert('Empty Cart', 'Add items before checking out.'); return; }
        const received = parseFloat(amountReceived) || 0;
        if (received < getTotal()) { Alert.alert('Insufficient Payment', 'Amount received is less than total.'); return; }

        setCheckoutLoading(true);
        try {
            const res  = await fetch(`${API_URL}/api/mobile/checkout/`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    user_id: user?.user_id,
                    items:   cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, price: i.price })),
                    total:   getTotal(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setLastReceipt({
                    receiptNo:  data.receipt_no || `RCP-${Date.now()}`,
                    date:       new Date(),
                    cashier:    user?.username || 'Cashier',
                    items:      [...cart],
                    subtotal:   getSubtotal(),
                    tax:        getTax(),
                    total:      getTotal(),
                    received:   received,
                    change:     getChange(),
                });
                setReceiptVisible(true);
            } else {
                Alert.alert('Error', data.message || 'Checkout failed.');
            }
        } catch (err) {
            Alert.alert('Error', 'Cannot reach server: ' + err.message);
        } finally {
            setCheckoutLoading(false);
        }
    };

    const closeReceipt = () => {
        setReceiptVisible(false);
        setCart([]);
        setAmountReceived('');
        loadProducts();
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const categories       = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (selectedCategory === 'All' || p.category === selectedCategory)
    );

    const formatDate = (d) => {
        if (!d) return '';
        return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
            + '  '
            + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={s.loadingScreen}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={s.loadingText}>Loading products…</Text>
            </SafeAreaView>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={C.white} />

            {/* ══ RECEIPT MODAL ════════════════════════════════════════════ */}
            <Modal
                visible={receiptVisible}
                transparent
                animationType="fade"
                onRequestClose={closeReceipt}
            >
                <View style={s.receiptOverlay}>
                    <View style={s.receiptSheet}>
                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                            {/* Store header */}
                            <View style={s.rcptHeader}>
                                <View style={s.rcptLogoRow}>
                                    <FontAwesome5 name="store" size={18} color={C.primary} />
                                    <Text style={s.rcptStoreName}>
                                        Grocer<Text style={{ color: C.accent }}>Ease</Text>
                                    </Text>
                                </View>
                                <Text style={s.rcptTagline}>Sales & Inventory System</Text>
                                <View style={s.rcptBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color={C.white} />
                                    <Text style={s.rcptBadgeText}>SALE COMPLETE</Text>
                                </View>
                            </View>

                            <View style={s.dashedLine} />

                            {/* Receipt meta */}
                            <View style={s.rcptMeta}>
                                <View style={s.rcptMetaRow}>
                                    <Text style={s.rcptMetaLabel}>Receipt No.</Text>
                                    <Text style={s.rcptMetaValue}>{lastReceipt?.receiptNo}</Text>
                                </View>
                                <View style={s.rcptMetaRow}>
                                    <Text style={s.rcptMetaLabel}>Date & Time</Text>
                                    <Text style={s.rcptMetaValue}>{formatDate(lastReceipt?.date)}</Text>
                                </View>
                                <View style={s.rcptMetaRow}>
                                    <Text style={s.rcptMetaLabel}>Cashier</Text>
                                    <Text style={s.rcptMetaValue}>{lastReceipt?.cashier}</Text>
                                </View>
                            </View>

                            <View style={s.dashedLine} />

                            {/* Items table header */}
                            <View style={s.rcptTableHead}>
                                <Text style={[s.rcptTh, { flex: 4 }]}>ITEM</Text>
                                <Text style={[s.rcptTh, { flex: 1, textAlign: 'center' }]}>QTY</Text>
                                <Text style={[s.rcptTh, { flex: 2, textAlign: 'right' }]}>AMOUNT</Text>
                            </View>

                            {/* Items */}
                            {lastReceipt?.items.map(item => (
                                <View key={item.product_id} style={s.rcptItem}>
                                    <Text style={[s.rcptItemName, { flex: 4 }]} numberOfLines={2}>
                                        {item.name}
                                    </Text>
                                    <Text style={[s.rcptItemQty, { flex: 1, textAlign: 'center' }]}>
                                        x{item.quantity}
                                    </Text>
                                    <Text style={[s.rcptItemAmt, { flex: 2, textAlign: 'right' }]}>
                                        ₱{(parseFloat(item.price) * item.quantity).toFixed(2)}
                                    </Text>
                                </View>
                            ))}

                            <View style={s.dashedLine} />

                            {/* Totals */}
                            <View style={s.rcptTotals}>
                                <View style={s.rcptTotalRow}>
                                    <Text style={s.rcptTotalLabel}>Subtotal</Text>
                                    <Text style={s.rcptTotalVal}>₱{lastReceipt?.subtotal.toFixed(2)}</Text>
                                </View>
                                <View style={s.rcptTotalRow}>
                                    <Text style={s.rcptTotalLabel}>VAT (12%)</Text>
                                    <Text style={s.rcptTotalVal}>₱{lastReceipt?.tax.toFixed(2)}</Text>
                                </View>
                                <View style={[s.rcptTotalRow, s.rcptGrandRow]}>
                                    <Text style={s.rcptGrandLabel}>TOTAL</Text>
                                    <Text style={s.rcptGrandVal}>₱{lastReceipt?.total.toFixed(2)}</Text>
                                </View>
                                <View style={s.rcptTotalRow}>
                                    <Text style={s.rcptTotalLabel}>Cash Received</Text>
                                    <Text style={s.rcptTotalVal}>₱{lastReceipt?.received.toFixed(2)}</Text>
                                </View>
                                <View style={[s.rcptTotalRow, s.rcptChangeRow]}>
                                    <Text style={s.rcptChangeLabel}>Change</Text>
                                    <Text style={s.rcptChangeVal}>₱{lastReceipt?.change.toFixed(2)}</Text>
                                </View>
                            </View>

                            <View style={s.dashedLine} />

                            {/* Thank you */}
                            <View style={s.rcptFooter}>
                                <Text style={s.rcptThankYou}>Thank you for shopping!</Text>
                                <Text style={s.rcptSlogan}>GrocerEase – Your trusted sari-sari store partner</Text>
                            </View>

                        </ScrollView>

                        <TouchableOpacity style={s.rcptCloseBtn} onPress={closeReceipt}>
                            <Ionicons name="add-circle-outline" size={18} color={C.white} />
                            <Text style={s.rcptCloseBtnText}>New Sale</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══ BARCODE SCANNER MODAL ════════════════════════════════════ */}
            {/* ← NEW: entire block below */}
            <Modal
                visible={scannerVisible}
                animationType="slide"
                onRequestClose={() => setScannerVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                        }}
                    />

                    {/* Scan frame overlay */}
                    <View style={scannerStyles.overlay}>
                        <View style={scannerStyles.frame} />
                        <Text style={scannerStyles.hint}>Point camera at barcode</Text>
                    </View>

                    {/* Close button */}
                    <TouchableOpacity
                        style={scannerStyles.closeBtn}
                        onPress={() => setScannerVisible(false)}
                    >
                        <FontAwesome5 name="times" size={18} color="#fff" />
                        <Text style={scannerStyles.closeBtnText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* ══ DRAWER ═══════════════════════════════════════════════════ */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={s.backdrop} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[s.drawer, { transform: [{ translateX: drawerX }] }]}>
                        <View style={s.drawerLogo}>
                            <View style={s.logoIcon}>
                                <FontAwesome5 name="store" size={16} color={C.white} />
                            </View>
                            <Text style={s.logoText}>
                                Grocer<Text style={{ color: C.accent }}>Ease</Text>
                            </Text>
                        </View>
                        <TouchableOpacity style={s.navItem} onPress={closeDrawer}>
                            <MaterialIcons name="point-of-sale" size={18} color={C.white} />
                            <Text style={s.navItemText}>Point of Sale</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.drawerLogout} onPress={() => navigation.replace('Login')}>
                            <Ionicons name="log-out-outline" size={18} color={C.danger} />
                            <Text style={s.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}

            {/* ══ TOP BAR ══════════════════════════════════════════════════ */}
            <View style={s.topbar}>
                <TouchableOpacity onPress={openDrawer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="menu" size={26} color={C.text} />
                </TouchableOpacity>

                <View style={s.topbarRight}>
                    {/* ← NEW: Barcode scan button */}
                    <TouchableOpacity
                        onPress={async () => {
                            if (!permission?.granted) {
                                const result = await requestPermission();
                                if (!result.granted) {
                                    Alert.alert('Permission needed', 'Camera permission is required to scan barcodes.');
                                    return;
                                }
                            }
                            setScannerVisible(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <FontAwesome5 name="barcode" size={22} color={C.text} />
                    </TouchableOpacity>

                    <View style={s.userRow}>
                        <FontAwesome5 name="user-circle" size={20} color={C.primary} />
                        <Text style={s.username}>{user?.username || 'Cashier'}</Text>
                    </View>
                    <TouchableOpacity style={s.logoutBtn} onPress={() => navigation.replace('Login')}>
                        <Text style={s.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ══ MAIN SCROLL ══════════════════════════════════════════════ */}
            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >

                {/* ── Products card ──────────────────────────────────────── */}
                <View style={s.card}>
                    <View style={s.cardHeader}>
                        <FontAwesome5 name="search" size={16} color={C.text} />
                        <Text style={s.cardTitle}>Select Products</Text>
                    </View>

                    <TextInput
                        style={s.searchBar}
                        placeholder="Search products..."
                        placeholderTextColor={C.muted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />

                    {/* Category pills */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.catContent}
                        style={s.catScroll}
                    >
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[s.catPill, selectedCategory === cat && s.catPillActive]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[s.catPillText, selectedCategory === cat && s.catPillTextActive]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* ── Fixed 2-column grid ───────────────────────────── */}
                    {filteredProducts.length === 0 ? (
                        <View style={s.emptyState}>
                            <FontAwesome5 name="box-open" size={28} color={C.border} />
                            <Text style={s.emptyText}>No products found</Text>
                        </View>
                    ) : (
                        Array.from({ length: Math.ceil(filteredProducts.length / 2) }, (_, i) =>
                            filteredProducts.slice(i * 2, i * 2 + 2)
                        ).map((pair, rowIdx) => (
                            <View key={rowIdx} style={s.gridRow}>
                                {pair.map(item => (
                                    <TouchableOpacity
                                        key={item.product_id}
                                        style={s.productCard}
                                        onPress={() => addToCart(item)}
                                        activeOpacity={0.72}
                                    >
                                        <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={s.productPrice}>₱{parseFloat(item.price).toFixed(2)}</Text>
                                        <Text style={[s.productStock, item.stock <= 5 && { color: C.danger }]}>
                                            Stock: {item.stock}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                {pair.length === 1 && <View style={s.productCardPlaceholder} />}
                            </View>
                        ))
                    )}
                </View>

                {/* ── Current Sale card ──────────────────────────────────── */}
                <View style={s.card}>
                    <View style={s.cartHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <MaterialIcons name="shopping-cart" size={22} color={C.text} />
                            <Text style={s.cardTitle}>Current Sale</Text>
                        </View>
                        <TouchableOpacity onPress={() => { setCart([]); setAmountReceived(''); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MaterialIcons name="delete-outline" size={16} color={C.danger} />
                                <Text style={s.clearText}>Clear Cart</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Table head */}
                    <View style={s.tableHead}>
                        <Text style={[s.th, { flex: 3 }]}>Item</Text>
                        <Text style={[s.th, { flex: 2, textAlign: 'center' }]}>Qty</Text>
                        <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>Price</Text>
                        <Text style={[s.th, { flex: 2, textAlign: 'right' }]}>Sub</Text>
                    </View>

                    {cart.length === 0 ? (
                        <View style={s.cartEmpty}>
                            <MaterialIcons name="shopping-cart" size={32} color={C.border} />
                            <Text style={s.cartEmptyText}>Cart is empty</Text>
                        </View>
                    ) : (
                        cart.map(item => (
                            <View key={item.product_id} style={s.tableRow}>
                                <Text style={[s.td, { flex: 3 }]} numberOfLines={2}>{item.name}</Text>
                                <View style={[s.qtyCtrl, { flex: 2 }]}>
                                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.product_id, -1)}>
                                        <Text style={s.qtyBtnText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={s.qtyNum}>{item.quantity}</Text>
                                    <TouchableOpacity style={s.qtyBtn} onPress={() => updateQty(item.product_id, 1)}>
                                        <Text style={s.qtyBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={[s.td, { flex: 2, textAlign: 'right' }]}>
                                    ₱{parseFloat(item.price).toFixed(2)}
                                </Text>
                                <Text style={[s.td, s.tdSub, { flex: 2, textAlign: 'right' }]}>
                                    ₱{(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </Text>
                            </View>
                        ))
                    )}

                    <View style={s.divider} />

                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Subtotal:</Text>
                        <Text style={s.summaryValue}>₱{getSubtotal().toFixed(2)}</Text>
                    </View>
                    <View style={s.summaryRow}>
                        <Text style={s.summaryLabel}>Tax (12%):</Text>
                        <Text style={s.summaryValue}>₱{getTax().toFixed(2)}</Text>
                    </View>
                    <View style={[s.summaryRow, s.totalRow]}>
                        <Text style={s.totalLabel}>Total:</Text>
                        <Text style={s.totalValue}>₱{getTotal().toFixed(2)}</Text>
                    </View>

                    <Text style={s.payLabel}>Amount Received:</Text>
                    <TextInput
                        style={s.payInput}
                        placeholder="0.00"
                        placeholderTextColor={C.muted}
                        keyboardType="decimal-pad"
                        value={amountReceived}
                        onChangeText={setAmountReceived}
                    />

                    <View style={s.changeRow}>
                        <Text style={s.changeLabel}>Change:</Text>
                        <Text style={[s.changeValue, getChange() < 0 && { color: C.danger }]}>
                            ₱{getChange().toFixed(2)}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[s.checkoutBtn, (cart.length === 0 || checkoutLoading) && s.checkoutDisabled]}
                        onPress={handleCheckout}
                        disabled={cart.length === 0 || checkoutLoading}
                        activeOpacity={0.85}
                    >
                        {checkoutLoading
                            ? <ActivityIndicator color={C.white} />
                            : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="checkmark-circle" size={20} color={C.white} />
                                    <Text style={s.checkoutText}>Complete Sale</Text>
                                </View>
                            )
                        }
                    </TouchableOpacity>
                </View>

                <Text style={s.footer}>
                    © 2026 GrocerEase – Sales & Inventory System. All rights reserved.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Main Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
    loadingText:   { marginTop: 12, color: C.muted, fontSize: 14 },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    drawer: {
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: DRAWER_W, backgroundColor: C.sidebar, paddingTop: 56, zIndex: 99,
    },
    drawerLogo: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingBottom: 32,
    },
    logoIcon: {
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    },
    logoText:        { fontSize: 22, fontWeight: '700', color: '#fff' },
    navItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 12, borderRadius: 10,
    },
    navItemText:     { color: '#fff', fontSize: 15, fontWeight: '500' },
    drawerLogout: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 20, paddingVertical: 14,
        marginTop: 16, marginHorizontal: 12,
    },
    drawerLogoutText: { color: C.danger, fontSize: 15, fontWeight: '600' },

    topbar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    userRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
    username:    { fontSize: 14, fontWeight: '600', color: C.text },
    logoutBtn:   { backgroundColor: C.danger, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    logoutText:  { color: C.white, fontSize: 13, fontWeight: '700' },

    scroll:        { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },

    card: {
        backgroundColor: C.white, borderRadius: 16, padding: CARD_PAD,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    cardTitle:  { fontSize: 20, fontWeight: '700', color: C.text },

    searchBar: {
        backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
        borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11,
        fontSize: 15, color: C.text, marginBottom: 14,
    },
    catScroll:         { marginBottom: 16 },
    catContent:        { gap: 8, paddingRight: 4 },
    catPill: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.white,
    },
    catPillActive:     { backgroundColor: C.primary, borderColor: C.primary },
    catPillText:       { fontSize: 13, color: C.muted, fontWeight: '500' },
    catPillTextActive: { color: C.white },

    gridRow: {
        flexDirection: 'row',
        gap:           GRID_GAP,
        marginBottom:  GRID_GAP,
    },
    productCard: {
        flex:            1,
        backgroundColor: C.bg,
        borderRadius:    14,
        padding:         16,
        alignItems:      'center',
        borderWidth:     1,
        borderColor:     C.border,
        minHeight:       110,
        justifyContent:  'center',
    },
    productCardPlaceholder: { flex: 1 },
    productName:  { fontSize: 14, fontWeight: '700', textAlign: 'center', color: C.text, marginBottom: 6, lineHeight: 20 },
    productPrice: { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 4 },
    productStock: { fontSize: 12, color: C.muted },
    emptyState:   { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyText:    { color: C.muted, fontSize: 14 },

    cartHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    clearText:     { fontSize: 13, color: C.danger, fontWeight: '600' },
    tableHead: {
        flexDirection: 'row', paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4,
    },
    th:            { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
    cartEmpty:     { alignItems: 'center', paddingVertical: 28, gap: 8 },
    cartEmptyText: { color: C.muted, fontSize: 14 },
    tableRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
    },
    td:    { fontSize: 13, color: C.text },
    tdSub: { fontWeight: '600', color: C.primary },
    qtyCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    qtyBtn: {
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    qtyBtnText: { fontSize: 16, fontWeight: '700', color: C.primary, lineHeight: 22 },
    qtyNum:     { fontSize: 13, fontWeight: '600', minWidth: 20, textAlign: 'center', color: C.text },

    divider:      { height: 1, backgroundColor: C.border, marginVertical: 14 },
    summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    summaryLabel: { fontSize: 14, color: C.muted },
    summaryValue: { fontSize: 14, color: C.text, fontWeight: '500' },
    totalRow:     { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
    totalLabel:   { fontSize: 18, fontWeight: '700', color: C.primary },
    totalValue:   { fontSize: 26, fontWeight: '800', color: C.primary },

    payLabel: { fontSize: 13, color: C.muted, marginTop: 16, marginBottom: 6 },
    payInput: {
        borderWidth: 1, borderColor: C.border, borderRadius: 10,
        padding: 12, fontSize: 16, color: C.text, marginBottom: 12,
    },
    changeRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: C.bg, borderRadius: 10, padding: 14, marginBottom: 16,
    },
    changeLabel: { fontSize: 15, fontWeight: '700', color: C.text },
    changeValue: { fontSize: 20, fontWeight: '700', color: C.primary },

    checkoutBtn: {
        backgroundColor: C.primary, borderRadius: 14,
        paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    },
    checkoutDisabled: { backgroundColor: '#b2bec3' },
    checkoutText:     { color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

    footer: { textAlign: 'center', fontSize: 12, color: C.muted, paddingTop: 4 },

    // ══ RECEIPT MODAL ══════════════════════════════════════════════════════════
    receiptOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    receiptSheet: {
        backgroundColor: C.receiptBg, borderRadius: 20,
        width: '100%', maxHeight: '88%', overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 }, elevation: 16,
    },
    rcptHeader: {
        alignItems: 'center', paddingTop: 28, paddingBottom: 20,
        paddingHorizontal: 24, backgroundColor: C.white,
    },
    rcptLogoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    rcptStoreName: { fontSize: 24, fontWeight: '800', color: C.text },
    rcptTagline:   { fontSize: 12, color: C.muted, marginBottom: 14 },
    rcptBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    },
    rcptBadgeText: { color: C.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    dashedLine: {
        borderStyle: 'dashed', borderWidth: 1, borderColor: C.border,
        marginHorizontal: 16, marginVertical: 12,
    },
    rcptMeta:      { paddingHorizontal: 20 },
    rcptMetaRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rcptMetaLabel: { fontSize: 12, color: C.muted },
    rcptMetaValue: { fontSize: 12, fontWeight: '600', color: C.text, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
    rcptTableHead: {
        flexDirection: 'row', paddingHorizontal: 20,
        paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    rcptTh: { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    rcptItem: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    rcptItemName: { fontSize: 13, color: C.text, lineHeight: 18 },
    rcptItemQty:  { fontSize: 13, color: C.muted },
    rcptItemAmt:  { fontSize: 13, fontWeight: '600', color: C.text },
    rcptTotals:     { paddingHorizontal: 20, paddingTop: 4 },
    rcptTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rcptTotalLabel: { fontSize: 13, color: C.muted },
    rcptTotalVal:   { fontSize: 13, color: C.text, fontWeight: '500' },
    rcptGrandRow: {
        borderTopWidth: 1, borderTopColor: C.border,
        marginTop: 6, paddingTop: 10, marginBottom: 4,
    },
    rcptGrandLabel: { fontSize: 17, fontWeight: '800', color: C.primary },
    rcptGrandVal:   { fontSize: 22, fontWeight: '800', color: C.primary },
    rcptChangeRow: {
        backgroundColor: C.primaryLight, borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 8, marginTop: 4,
    },
    rcptChangeLabel: { fontSize: 14, fontWeight: '700', color: C.primary },
    rcptChangeVal:   { fontSize: 18, fontWeight: '800', color: C.primary },
    rcptFooter: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20 },
    rcptThankYou: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
    rcptSlogan:   { fontSize: 11, color: C.muted, textAlign: 'center' },
    rcptCloseBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: C.primary, margin: 16, borderRadius: 14, paddingVertical: 15,
    },
    rcptCloseBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
});

// ─── Barcode Scanner Styles ───────────────────────────────────────────────────
// ← NEW: entire scannerStyles block
const scannerStyles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    frame: {
        width: 250, height: 250,
        borderWidth: 3, borderColor: '#1e6f5c',
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    hint: {
        color: '#fff', fontSize: 14,
        marginTop: 20, fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20,
    },
    closeBtn: {
        position: 'absolute', bottom: 50,
        alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#e74c3c',
        paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 30,
    },
    closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});