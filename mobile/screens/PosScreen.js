import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, FlatList
} from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { colors, globalStyles } from '../styles/GlobalStyles';
import API_URL from '../config';

export default function POSScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [products, setProducts]             = useState([]);
    const [cart, setCart]                     = useState([]);
    const [loading, setLoading]               = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [searchQuery, setSearchQuery]       = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Load products from Django API
    const loadProducts = useCallback(async () => {
        try {
            const res  = await fetch(`${API_URL}/api/mobile/products/`);
            const data = await res.json();
            if (data.success) setProducts(data.products || []);
            else Alert.alert('Error', 'Failed to load products.');
        } catch (err) {
            Alert.alert('Error', 'Failed to load products: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProducts(); }, []);

    // Add product to cart
    const addToCart = (product) => {
        const existing = cart.find(item => item.product_id === product.product_id);
        if (existing) {
            if (existing.quantity >= product.stock) {
                Alert.alert('Error', 'Not enough stock available.');
                return;
            }
            setCart(cart.map(item =>
                item.product_id === product.product_id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    // Calculate total
    const getTotal = () =>
        cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

    // Checkout
    const handleCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Error', 'Cart is empty.');
            return;
        }
        setCheckoutLoading(true);
        try {
            const res  = await fetch(`${API_URL}/api/mobile/checkout/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user?.user_id,
                    items: cart.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        price: i.price,
                    })),
                    total: getTotal(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                Alert.alert('Success!', `Sale complete! Total: ₱${getTotal().toFixed(2)}`, [
                    { text: 'OK', onPress: () => { setCart([]); loadProducts(); } }
                ]);
            } else {
                Alert.alert('Error', data.message || 'Checkout failed.');
            }
        } catch (err) {
            Alert.alert('Error', 'Cannot reach server: ' + err.message);
        } finally {
            setCheckoutLoading(false);
        }
    };

    // Get unique categories from products
    const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch   = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (loading) {
        return (
            <View style={globalStyles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12 }}>Loading products...</Text>
            </View>
        );
    }

    return (
        <View style={styles.screen}>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <FontAwesome5 name="store" size={24} color={colors.primary} />
                    <Text style={styles.logoText}>
                        Grocer<Text style={{ color: colors.secondary }}>Ease</Text>
                    </Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.userInfo}>
                        <FontAwesome5 name="user-circle" size={20} color={colors.primary} />
                        <Text style={styles.username}>{user?.username || 'Cashier'}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        onPress={() => navigation.replace('Login')}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 15 }}>
                        <Text style={styles.mainTitle}>Select Products</Text>
                        <TextInput
                            style={styles.searchBar}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        
                        {/* Category Filter */}
                        <View style={styles.categoryContainer}>
                            <Text style={styles.categoryLabel}>Category:</Text>
                            <View style={styles.categoryButtons}>
                                {categories.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.categoryButton,
                                            selectedCategory === cat && styles.categoryButtonActive
                                        ]}
                                        onPress={() => setSelectedCategory(cat)}
                                    >
                                        <Text style={[
                                            styles.categoryButtonText,
                                            selectedCategory === cat && styles.categoryButtonTextActive
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                }
                data={filteredProducts}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text style={styles.productPrice}>₱{parseFloat(item.price).toFixed(2)}</Text>
                        <Text style={styles.productStock}>Stock: {item.stock}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={item => item.product_id.toString()}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.scrollContainer}
            />

            {/* Footer / Cart */}
            <View style={styles.footer}>
                <View style={styles.footerHeader}>
                    <Text style={styles.footerTitle}>🛒 Current Sale</Text>
                    <TouchableOpacity onPress={() => setCart([])}>
                        <Text style={styles.clearText}>🗑 Clear Cart</Text>
                    </TouchableOpacity>
                </View>

                {/* Cart Items Summary */}
                {cart.length > 0 && (
                    <View style={styles.cartItems}>
                        {cart.map(item => (
                            <View key={item.product_id} style={styles.cartItem}>
                                <Text style={styles.cartItemName}>{item.name}</Text>
                                <View style={styles.cartItemControls}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (item.quantity === 1) {
                                                setCart(cart.filter(i => i.product_id !== item.product_id));
                                            } else {
                                                setCart(cart.map(i =>
                                                    i.product_id === item.product_id
                                                        ? { ...i, quantity: i.quantity - 1 }
                                                        : i
                                                ));
                                            }
                                        }}
                                        style={styles.quantityBtn}
                                    >
                                        <Text style={styles.quantityBtnText}>-</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.cartItemQty}>{item.quantity}</Text>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            if (item.quantity < item.stock) {
                                                setCart(cart.map(i =>
                                                    i.product_id === item.product_id
                                                        ? { ...i, quantity: i.quantity + 1 }
                                                        : i
                                                ));
                                            } else {
                                                Alert.alert('Error', 'Not enough stock available.');
                                            }
                                        }}
                                        style={styles.quantityBtn}
                                    >
                                        <Text style={styles.quantityBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.cartItemPrice}>
                                    ₱{(parseFloat(item.price) * item.quantity).toFixed(2)}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.totalRow}>
                    <Text style={styles.totalText}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₱{getTotal().toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.checkoutBtn, cart.length === 0 && { backgroundColor: '#ccc' }]}
                    onPress={handleCheckout}
                    disabled={cart.length === 0 || checkoutLoading}
                >
                    {checkoutLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.checkoutBtnText}>COMPLETE SALE</Text>
                    }
                </TouchableOpacity>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8f9fa' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    },
    headerLeft:  { flexDirection: 'row', alignItems: 'center' },
    logoText:    { fontSize: 22, fontWeight: 'bold', marginLeft: 10, color: '#2d3436' },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    userInfo:    { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    username:    { marginLeft: 5, fontWeight: '600', color: '#2d3436' },
    logoutBtn:   { backgroundColor: '#e17055', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    logoutText:  { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    scrollContainer: { paddingBottom: 15 },
    mainTitle:   { fontSize: 28, fontWeight: 'bold', color: '#2d3436', marginBottom: 15 },
    searchBar:   { 
        backgroundColor: '#fff', padding: 15, borderRadius: 10, 
        borderWidth: 1, borderColor: '#dfe6e9', marginBottom: 15,
        fontSize: 16,
    },
    
    categoryContainer: {
        marginBottom: 20,
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2d3436',
        marginBottom: 10,
    },
    categoryButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    categoryButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#dfe6e9',
    },
    categoryButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    categoryButtonText: {
        color: '#2d3436',
        fontSize: 14,
    },
    categoryButtonTextActive: {
        color: '#fff',
    },

    row: { justifyContent: 'space-between', paddingHorizontal: 15 },
    productCard: {
        backgroundColor: '#fff', width: '48%', padding: 15, borderRadius: 15,
        marginBottom: 15, alignItems: 'center', shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    },
    productName:  { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
    productPrice: { fontSize: 18, color: '#1e6f5c', fontWeight: 'bold', marginVertical: 5 },
    productStock: { fontSize: 12, color: '#636e72' },

    footer: { 
        backgroundColor: '#fff', padding: 20, 
        borderTopLeftRadius: 30, borderTopRightRadius: 30, 
        elevation: 10, shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4,
    },
    footerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    footerTitle:  { fontSize: 18, fontWeight: 'bold', color: '#2d3436' },
    clearText:    { color: '#e17055', fontWeight: 'bold' },
    
    cartItems: {
        maxHeight: 200,
        marginBottom: 15,
    },
    cartItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    cartItemName: {
        flex: 2,
        fontSize: 14,
        color: '#2d3436',
    },
    cartItemControls: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 10,
    },
    quantityBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    cartItemQty: {
        marginHorizontal: 10,
        fontSize: 14,
        fontWeight: '600',
        minWidth: 20,
        textAlign: 'center',
    },
    cartItemPrice: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e6f5c',
        textAlign: 'right',
    },
    
    totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingTop: 10 },
    totalText:    { fontSize: 18, fontWeight: '600', color: '#2d3436' },
    totalValue:   { fontSize: 28, fontWeight: 'bold', color: '#1e6f5c' },
    checkoutBtn:  { backgroundColor: '#1e6f5c', padding: 18, borderRadius: 15, alignItems: 'center' },
    checkoutBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});