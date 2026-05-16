import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
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
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function InventoryScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, low-stock, out-of-stock

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

    const getStockStatus = (product) => {
        if (product.stock <= 0) {
            return { label: 'Out of Stock', color: COLORS.danger, icon: 'times-circle' };
        } else if (product.stock <= product.reorder_level) {
            return { label: 'Low Stock', color: COLORS.warning, icon: 'exclamation-circle' };
        }
        return { label: 'In Stock', color: COLORS.success, icon: 'check-circle' };
    };

    const renderProductItem = ({ item }) => {
        const status = getStockStatus(item);
        return (
            <View style={styles.productCard}>
                <View style={styles.productHeader}>
                    <View style={styles.productInfo}>
                        <Text style={styles.productName}>{item.name}</Text>
                        <Text style={styles.productCategory}>
                            {item.category || 'Uncategorized'} • {item.unit || 'pieces'}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                        <FontAwesome5 name={status.icon} size={12} color={status.color} />
                        <Text style={[styles.statusLabel, { color: status.color }]}>
                            {status.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.productDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Current Stock:</Text>
                        <Text style={[styles.detailValue, { color: status.color, fontWeight: '700' }]}>
                            {item.stock} {item.unit || ''}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Reorder Level:</Text>
                        <Text style={styles.detailValue}>{item.reorder_level || 0}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Price:</Text>
                        <Text style={styles.detailValue}>
                            {typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : 'N/A'}
                        </Text>
                    </View>
                </View>

                <View style={styles.stockBar}>
                    <View
                        style={[
                            styles.stockBarFill,
                            {
                                width: `${Math.min(
                                    (item.stock / (item.reorder_level * 2 || 1)) * 100,
                                    100
                                )}%`,
                                backgroundColor: status.color,
                            },
                        ]}
                    />
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.root}>
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialIcons name="arrow-back" size={26} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Inventory</Text>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.searchBar}>
                <FontAwesome5 name="search" size={14} color={COLORS.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.textMuted}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <MaterialIcons name="close" size={18} color={COLORS.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.filterBar}>
                {[
                    { key: 'all', label: 'All', icon: 'boxes' },
                    { key: 'low-stock', label: 'Low Stock', icon: 'exclamation-circle' },
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
                            size={12}
                            color={filterType === filter.key ? COLORS.white : COLORS.text}
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

            {filteredProducts.length === 0 ? (
                <View style={styles.emptyState}>
                    <FontAwesome5 name="inbox" size={48} color={COLORS.border} />
                    <Text style={styles.emptyStateText}>
                        {searchQuery ? 'No products found' : 'No inventory items'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={(item) => item.product_id.toString()}
                    renderItem={renderProductItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <View style={styles.summaryFooter}>
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Products</Text>
                    <Text style={styles.summaryValue}>{products.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Low Stock</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                        {products.filter((p) => p.stock <= p.reorder_level && p.stock > 0).length}
                    </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Out of Stock</Text>
                    <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
                        {products.filter((p) => p.stock <= 0).length}
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: COLORS.white,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.text,
    },
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: COLORS.white,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 4,
    },
    filterButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
    },
    filterButtonTextActive: {
        color: COLORS.white,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 180,
    },
    productCard: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    productInfo: {
        flex: 1,
        marginRight: 8,
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
    },
    productCategory: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 4,
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
    productDetails: {
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
    },
    stockBar: {
        height: 6,
        backgroundColor: COLORS.bg,
        borderRadius: 3,
        overflow: 'hidden',
    },
    stockBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateText: {
        marginTop: 12,
        fontSize: 14,
        color: COLORS.textMuted,
    },
    summaryFooter: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 12,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.border,
    },
});
