import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, FlatList
} from 'react-native';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { colors, globalStyles } from '../styles/GlobalStyles';
import { getProducts, supabase } from '../supabase';

export default function POSScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Load products
    const loadProducts = useCallback(async () => {
        try {
            const { data, error } = await getProducts();
            if (error) {
                Alert.alert('Error', 'Failed to load products.');
                return;
            }
            setProducts(data || []);
        } catch (err) {
            Alert.alert('Error', 'Failed to load products.');
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
    const getTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    // Checkout logic
    const handleCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Error', 'Cart is empty.');
            return;
        }
        setCheckoutLoading(true);
        // ... your existing checkout logic (supabase inserts) ...
        setCheckoutLoading(false);
    };

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
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

    // The return MUST be inside the function block
    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <FontAwesome5 name="store" size={24} color={colors.primary} />
                    <Text style={styles.logoText}>Grocer<Text style={{color: colors.secondary}}>Ease</Text></Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={styles.userInfo}>
                        <FontAwesome5 name="user-circle" size={20} color={colors.primary} />
                        <Text style={styles.username}>{user?.username || 'Cashier'}</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutBtn} onPress={() => navigation.replace('Login')}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                ListHeaderComponent={
                    <View style={{paddingHorizontal: 15}}>
                        <Text style={styles.mainTitle}><FontAwesome5 name="search" size={20} /> Select Products</Text>
                        <TextInput 
                            style={styles.searchBar} 
                            placeholder="Search products..." 
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <View style={styles.pickerContainer}>
                            <Text style={styles.pickerLabel}>{selectedCategory}</Text>
                            <MaterialIcons name="keyboard-arrow-down" size={24} color="black" />
                        </View>
                    </View>
                }
                data={filteredProducts}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text style={styles.productPrice}>₱{item.price.toFixed(2)}</Text>
                        <Text style={styles.productStock}>Stock: {item.stock}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={item => item.product_id.toString()}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.scrollContainer}
            />

            {/* Current Sale Footer */}
            <View style={styles.footer}>
                <View style={styles.footerHeader}>
                    <Text style={styles.footerTitle}><FontAwesome5 name="shopping-cart" size={18} /> Current Sale</Text>
                    <TouchableOpacity onPress={() => setCart([])}>
                        <Text style={styles.clearText}><FontAwesome5 name="trash" size={12} /> Clear Cart</Text>
                    </TouchableOpacity>
                </View>
                
                <View style={styles.totalRow}>
                    <Text style={styles.totalText}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₱{getTotal().toFixed(2)}</Text>
                </View>

                <TouchableOpacity 
                    style={[styles.checkoutBtn, cart.length === 0 && {backgroundColor: '#ccc'}]} 
                    onPress={handleCheckout}
                    disabled={cart.length === 0 || checkoutLoading}
                >
                    {checkoutLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>COMPLETE SALE</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
} // Closing POSScreen function

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { 
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15, backgroundColor: '#fff' 
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    logoText: { fontSize: 22, fontWeight: 'bold', marginLeft: 10, color: '#2d3436' },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    userInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
    username: { marginLeft: 5, fontWeight: '600' },
    logoutBtn: { backgroundColor: '#e17055', padding: 8, borderRadius: 8 },
    logoutText: { color: '#fff', fontWeight: 'bold' },

    scrollContainer: { paddingVertical: 15 },
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: '#2d3436', marginBottom: 15 },
    searchBar: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#dfe6e9', marginBottom: 10 },
    pickerContainer: { 
        flexDirection: 'row', justifyContent: 'space-between', padding: 15, 
        backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#dfe6e9', marginBottom: 20 
    },

    row: { justifyContent: 'space-between', paddingHorizontal: 15 },
    productCard: {
        backgroundColor: '#fff', width: '48%', padding: 20, borderRadius: 15,
        marginBottom: 15, alignItems: 'center', shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    },
    productName: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    productPrice: { fontSize: 18, color: '#1e6f5c', fontWeight: 'bold', marginVertical: 5 },
    productStock: { fontSize: 12, color: '#636e72' },

    footer: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 10 },
    footerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    footerTitle: { fontSize: 18, fontWeight: 'bold' },
    clearText: { color: '#e17055', fontWeight: 'bold' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    totalText: { fontSize: 16, color: '#636e72' },
    totalValue: { fontSize: 24, fontWeight: 'bold', color: '#1e6f5c' },
    checkoutBtn: { backgroundColor: '#1e6f5c', padding: 18, borderRadius: 15, alignItems: 'center' },
    checkoutBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
