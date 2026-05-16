import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl, StatusBar,
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

export default function StockInHistoryScreen({ navigation, route }) {
    const { user } = route.params || {}; 
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [records, setRecords] = useState([]);
    const [filterProductSearch, setFilterProductSearch] = useState('');
    const [filterSupplierSearch, setFilterSupplierSearch] = useState('');
    const [filterDateText, setFilterDateText] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const loadRecords = useCallback(async () => {
        try {
            let data;
            try {
                data = await fetchJson(`${API_URL}/api/mobile/stock-in/history/`);
            } catch (err) {
                if (err.status === 404) {
                    data = await fetchJson(`${API_URL}/api/stock-in/`);
                } else {
                    throw err;
                }
            }

            if (data.success) {
                setRecords(data.records || []);
            } else {
                Alert.alert('Error', data.message || 'Unable to load stock in history.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
            console.warn('StockInHistory loadRecords error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadRecords();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    const getFilteredRecords = () => {
        return records.filter((item) => {
            let matches = true;
            if (filterProductSearch.trim()) {
                matches = matches && item.product_name?.toLowerCase().includes(filterProductSearch.toLowerCase());
            }
            if (filterSupplierSearch.trim()) {
                matches = matches && item.supplier?.toLowerCase().includes(filterSupplierSearch.toLowerCase());
            }
            if (filterDate) {
                matches = matches && item.date_received?.split('T')[0] === filterDate;
            }
            return matches;
        });
    };

    const filteredRecords = getFilteredRecords();

    const calculateStats = () => {
        const today = new Date();
        const totalRecords = filteredRecords.length;
        const totalUnits = filteredRecords.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
        const totalSuppliers = new Set(filteredRecords.map(item => item.supplier).filter(Boolean)).size;
        const thisMonthCount = filteredRecords.filter((item) => {
            if (!item.date_received) return false;
            const date = new Date(item.date_received);
            return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        }).length;
        return { totalRecords, totalUnits, totalSuppliers, thisMonthCount };
    };

    const { totalRecords, totalUnits, totalSuppliers, thisMonthCount } = calculateStats();

    const renderListHeader = () => (
        <>
            <View style={styles.statsContainer}>
                <View style={styles.statsCard}>
                    <View style={styles.statsIconContainer}><FontAwesome5 name="boxes" size={18} color={COLORS.primary} /></View>
                    <Text style={styles.statsValue}>{totalRecords}</Text>
                    <Text style={styles.statsLabel}>Total Records</Text>
                </View>
                <View style={styles.statsCard}>
                    <View style={styles.statsIconContainer}><FontAwesome5 name="cubes" size={18} color={COLORS.primary} /></View>
                    <Text style={styles.statsValue}>{totalUnits}</Text>
                    <Text style={styles.statsLabel}>Total Units</Text>
                </View>
                <View style={styles.statsCard}>
                    <View style={styles.statsIconContainer}><FontAwesome5 name="truck" size={18} color={COLORS.primary} /></View>
                    <Text style={styles.statsValue}>{totalSuppliers}</Text>
                    <Text style={styles.statsLabel}>Total Suppliers</Text>
                </View>
                <View style={styles.statsCard}>
                    <View style={styles.statsIconContainer}><FontAwesome5 name="calendar-day" size={18} color={COLORS.primary} /></View>
                    <Text style={styles.statsValue}>{thisMonthCount}</Text>
                    <Text style={styles.statsLabel}>This Month</Text>
                </View>
            </View>

            <View style={styles.filtersContainer}>
                <View style={styles.filterControl}>
                    <Text style={styles.filterLabel}>Product</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Search product"
                        value={filterProductSearch}
                        onChangeText={setFilterProductSearch}
                    />
                </View>
                <View style={styles.filterControl}>
                    <Text style={styles.filterLabel}>Supplier</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Search supplier"
                        value={filterSupplierSearch}
                        onChangeText={setFilterSupplierSearch}
                    />
                </View>
                <View style={styles.filterControl}>
                    <Text style={styles.filterLabel}>Date</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="MM/DD/YYYY"
                        value={filterDateText}
                        onChangeText={(text) => {
                            const digits = text.replace(/\D/g, '').slice(0, 8);
                            const month = digits.slice(0, 2);
                            const day = digits.slice(2, 4);
                            const year = digits.slice(4, 8);
                            const formatted = [month, day, year].filter(Boolean).join('/');
                            setFilterDateText(formatted);
                            setFilterDate(digits.length === 8 ? `${year}-${month}-${day}` : '');
                        }}
                        keyboardType="number-pad"
                        maxLength={10}
                    />
                </View>
            </View>
        </>
    );

    const renderRecordItem = ({ item }) => (
        <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordProductName}>{item.product_name}</Text>
                <Text style={styles.recordQuantity}>+{item.quantity} {item.unit}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Supplier:</Text>
                <Text style={styles.recordValue}>{item.supplier || 'N/A'}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Date Received:</Text>
                <Text style={styles.recordValue}>{formatDate(item.date_received)}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Received by:</Text>
                <Text style={styles.recordValue}>{item.received_by_name || 'Unknown'}</Text>
            </View>
            {item.notes ? (
                <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Notes:</Text>
                    <Text style={styles.recordValue}>{item.notes}</Text>
                </View>
            ) : null}
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.root}>
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
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
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Stock In History</Text>
                    <Text style={styles.headerSubtitle}>View stock in totals and record history</Text>
                </View>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.content}>
                <FlatList
                    data={filteredRecords}
                    keyExtractor={(item) => item.stock_in_id?.toString()}
                    renderItem={renderRecordItem}
                    ListHeaderComponent={renderListHeader}
                    ListHeaderComponentStyle={styles.listHeader}
                    contentContainerStyle={[styles.listContent, styles.listContentGrow]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    showsVerticalScrollIndicator={true}
                    style={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No stock in records found.</Text>
                        </View>
                    }
                />
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
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: COLORS.white,
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 16,
    },
    statsCard: {
        width: '48%',
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
    },
    statsIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    statsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    statsLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    filterControl: {
        flexBasis: '48%',
        minWidth: '48%',
        marginBottom: 12,
    },
    filterLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: COLORS.text,
        backgroundColor: COLORS.white,
    },
    recordCard: {
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    recordProductName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
        marginRight: 12,
    },
    recordQuantity: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    recordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    recordLabel: {
        color: COLORS.textMuted,
        fontSize: 12,
        width: '40%',
    },
    recordValue: {
        color: COLORS.text,
        fontSize: 13,
        width: '58%',
        textAlign: 'right',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        color: COLORS.textMuted,
        fontSize: 14,
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    list: {
        flex: 1,
    },
    listHeader: {
        paddingBottom: 12,
    },
    listContent: {
        paddingBottom: 24,
    },
    listContentGrow: {
        flexGrow: 1,
    },
});
