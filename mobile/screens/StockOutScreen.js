import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, ScrollView, RefreshControl,
    StatusBar, Modal, FlatList, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
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
};

const STOCK_OUT_REASONS = ['damaged', 'expired', 'lost', 'adjustment', 'return', 'other'];

const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
        const errorBody = contentType.includes('application/json')
            ? await response.json().catch(() => null)
            : await response.text().catch(() => null);
        const message = errorBody?.message || errorBody || response.statusText || 'Unknown error';
        throw new Error(`Request failed ${response.status}: ${message}`);
    }

    if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        throw new Error(`Expected JSON response but got ${contentType}: ${text.slice(0, 200)}`);
    }

    return response.json();
};

export default function StockOutScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [records, setRecords] = useState([]);
    const [products, setProducts] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [filterProductSearch, setFilterProductSearch] = useState('');
    const [filterDateText, setFilterDateText] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterReason, setFilterReason] = useState('all');
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    const today = new Date();
    const initialYear = String(today.getFullYear());
    const initialMonth = String(today.getMonth() + 1).padStart(2, '0');
    const initialDay = String(today.getDate()).padStart(2, '0');

    const [formData, setFormData] = useState({
        product_id: '',
        quantity: '',
        reason: 'damaged',
        unit: 'pieces',
        supplier: '',
        date: `${initialYear}-${initialMonth}-${initialDay}`,
        date_month: initialMonth,
        date_day: initialDay,
        date_year: initialYear,
        notes: '',
    });

    const loadData = useCallback(async () => {
        try {
            const [recordsResult, productsResult] = await Promise.allSettled([
                fetchJson(`${API_URL}/api/mobile/stock-out/`),
                fetchJson(`${API_URL}/api/mobile/products/`),
            ]);

            if (recordsResult.status === 'fulfilled' && recordsResult.value.success) {
                setRecords(recordsResult.value.records || []);
            } else if (recordsResult.status === 'rejected') {
                console.warn('Stock out records load failed:', recordsResult.reason);
            }

            if (productsResult.status === 'fulfilled' && productsResult.value.success) {
                setProducts(productsResult.value.products || []);
            } else if (productsResult.status === 'rejected') {
                console.warn('Products load failed:', productsResult.reason);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to load data: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openForm = () => {
        setProductSearch('');
        const today = new Date();
        const year = String(today.getFullYear());
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setFormData({
            product_id: '',
            quantity: '',
            reason: 'damaged',
            unit: 'pieces',
            supplier: '',
            date: `${year}-${month}-${day}`,
            date_month: month,
            date_day: day,
            date_year: year,
            notes: '',
        });
        setDatePickerVisible(false);
        setModalVisible(true);
    };

    const closeForm = () => {
        setModalVisible(false);
        setProcessing(false);
    };

    const updateDatePart = (part, value) => {
        const cleaned = value.replace(/\D/g, '');
        const normalized = part === 'date_year' ? cleaned.slice(0, 4) : cleaned.slice(0, 2);
        setFormData((prev) => {
            const next = { ...prev, [part]: normalized };
            const year = next.date_year;
            const month = next.date_month.padStart(2, '0');
            const day = next.date_day.padStart(2, '0');
            if (year.length === 4 && month.length === 2 && day.length === 2) {
                next.date = `${year}-${month}-${day}`;
            } else {
                next.date = '';
            }
            return next;
        });
    };

    const formatDateInputValue = (month, day, year) => {
        const parts = [];
        if (month) parts.push(month);
        if (day) parts.push(day);
        if (year) parts.push(year);
        return parts.join('/');
    };

    const handleDateInputChange = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 8);
        const month = digits.slice(0, 2);
        const day = digits.slice(2, 4);
        const year = digits.slice(4, 8);
        setFormData((prev) => ({
            ...prev,
            date_month: month,
            date_day: day,
            date_year: year,
            date: month.length === 2 && day.length === 2 && year.length === 4
                ? `${year}-${month}-${day}`
                : '',
        }));
    };

    const handleFilterDateTextChange = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 8);
        const month = digits.slice(0, 2);
        const day = digits.slice(2, 4);
        const year = digits.slice(4, 8);
        const formatted = [month, day, year].filter(Boolean).join('/');
        setFilterDateText(formatted);
        setFilterDate(digits.length === 8 ? `${year}-${month}-${day}` : '');
    };

    const handleAddStockOut = async () => {
        if (!formData.product_id || !formData.quantity) {
            Alert.alert('Validation', 'Product and quantity are required.');
            return;
        }

        setProcessing(true);
        try {
            const body = JSON.stringify({
                product_id: formData.product_id,
                quantity: parseInt(formData.quantity, 10),
                reason: formData.reason,
                unit: formData.unit,
                supplier: formData.supplier,
                date: formData.date,
                notes: formData.notes,
                user_id: user?.user_id,
            });

            let data;
            try {
                data = await fetchJson(`${API_URL}/api/mobile/stock-out/add/`, {
                    method: 'POST',
                    body,
                });
            } catch (err) {
                if (err.status === 404) {
                    data = await fetchJson(`${API_URL}/api/stock-out/add/`, {
                        method: 'POST',
                        body,
                    });
                } else {
                    throw err;
                }
            }

            if (data.success) {
                Alert.alert('Success', data.message || 'Stock Out recorded successfully.');
                closeForm();
                setRefreshing(true);
                loadData();
            } else {
                Alert.alert('Error', data.message || 'Failed to record stock out.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
            console.warn('StockOut add failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const calculateStats = () => {
        const totalRecords = records.length;
        const totalDamaged = records.filter(r => r.reason === 'damaged').reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
        const totalExpired = records.filter(r => r.reason === 'expired').reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
        const totalSold = records.filter(r => !['damaged', 'expired', 'lost', 'adjustment'].includes(r.reason)).reduce((sum, r) => sum + (parseInt(r.quantity) || 0), 0);
        return { totalRecords, totalDamaged, totalExpired, totalSold };
    };

    const renderStatsCard = (title, value, icon, color) => (
        <View style={styles.statsCard}>
            <View style={[styles.statsIconContainer, { backgroundColor: color + '20' }]}>
                <FontAwesome5 name={icon} size={20} color={color} />
            </View>
            <Text style={styles.statsValue}>{value}</Text>
            <Text style={styles.statsLabel}>{title}</Text>
        </View>
    );

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    const getFilteredProducts = () => {
        if (!productSearch.trim()) return products;
        return products.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase())
        );
    };

    const getFilteredProductsForFilter = () => {
        if (!filterProductSearch.trim()) return products;
        return products.filter(p =>
            p.name.toLowerCase().includes(filterProductSearch.toLowerCase())
        );
    };

    const getFilteredRecords = () => {
        return records.filter((item) => {
            let matches = true;
            if (filterProductSearch.trim()) {
                matches = matches && item.product_name?.toLowerCase().includes(filterProductSearch.toLowerCase());
            }
            if (filterDate) {
                matches = matches && item.date?.split('T')[0] === filterDate;
            }
            if (filterReason && filterReason !== 'all') {
                matches = matches && item.reason === filterReason;
            }
            return matches;
        });
    };

    const getReasonColor = (reason) => {
        const colors = {
            damaged: COLORS.danger,
            expired: COLORS.warning,
            lost: COLORS.danger,
            adjustment: COLORS.textMuted,
            return: COLORS.accent,
            other: COLORS.textMuted,
        };
        return colors[reason] || COLORS.textMuted;
    };

    const renderListHeader = () => (
        <>
            <View style={styles.statsContainer}>
                {(() => {
                    const { totalRecords, totalDamaged, totalExpired, totalSold } = calculateStats();
                    return (
                        <>
                            {renderStatsCard('Total Records', totalRecords, 'boxes', COLORS.text)}
                            {renderStatsCard('Total Sold', totalSold, 'shopping-cart', COLORS.success)}
                            {renderStatsCard('Damaged', totalDamaged, 'exclamation-circle', COLORS.danger)}
                            {renderStatsCard('Expired', totalExpired, 'calendar-times', COLORS.warning)}
                        </>
                    );
                })()}
            </View>

            <View style={styles.actionBar}>
                <TouchableOpacity style={styles.addButton} onPress={openForm}>
                    <FontAwesome5 name="plus" size={16} color={COLORS.white} />
                    <Text style={styles.addButtonText}>New Stock Out</Text>
                </TouchableOpacity>
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
                    <Text style={styles.filterLabel}>Date</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="MM/DD/YYYY"
                        value={filterDateText}
                        onChangeText={handleFilterDateTextChange}
                        keyboardType="number-pad"
                        maxLength={10}
                    />
                </View>
                <View style={[styles.filterControl, styles.fullWidthFilter]}>
                    <Text style={styles.filterLabel}>Reason</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={filterReason}
                            onValueChange={(value) => setFilterReason(value)}
                            style={styles.picker}
                        >
                            <Picker.Item label="All Reasons" value="all" />
                            {STOCK_OUT_REASONS.map((reason) => (
                                <Picker.Item
                                    key={reason}
                                    label={reason.charAt(0).toUpperCase() + reason.slice(1)}
                                    value={reason}
                                />
                            ))}
                        </Picker>
                    </View>
                </View>
            </View>
        </>
    );

    const renderRecordItem = ({ item }) => (
        <View style={styles.recordCard}>
            <View style={styles.recordHeader}>
                <Text style={styles.recordProductName}>{item.product_name}</Text>
                <Text style={styles.recordQuantity}>-{item.quantity} {item.unit}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Reason:</Text>
                <View style={[styles.reasonBadge, { backgroundColor: getReasonColor(item.reason) + '20' }]}>
                    <Text style={[styles.reasonText, { color: getReasonColor(item.reason) }]}>
                        {item.reason.charAt(0).toUpperCase() + item.reason.slice(1)}
                    </Text>
                </View>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Date:</Text>
                <Text style={styles.recordValue}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Recorded by:</Text>
                <Text style={styles.recordValue}>{item.recorded_by_name || 'Unknown'}</Text>
            </View>
            {item.notes && (
                <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Notes:</Text>
                    <Text style={styles.recordValue}>{item.notes}</Text>
                </View>
            )}
        </View>
    );

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
                <Text style={styles.headerTitle}>Stock Out</Text>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.content}>
                <FlatList
                    data={getFilteredRecords()}
                    keyExtractor={(item) => item.stock_out_id}
                    renderItem={renderRecordItem}
                    ListHeaderComponent={renderListHeader}
                    ListHeaderComponentStyle={styles.listHeader}
                    contentContainerStyle={[styles.listContent, styles.listContentGrow]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    style={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <FontAwesome5 name="inbox" size={48} color={COLORS.border} />
                            <Text style={styles.emptyStateText}>No stock out records yet</Text>
                        </View>
                    }
                />
            </View>

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeForm}>
                <TouchableWithoutFeedback onPress={closeForm}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <View style={styles.modalContainer}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Record Stock Out</Text>
                            <TouchableOpacity onPress={closeForm}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.formContent}>
                            <Text style={styles.label}>Product *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Search products..."
                                value={productSearch}
                                onChangeText={setProductSearch}
                            />
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.product_id}
                                    onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select a product..." value="" />
                                    {getFilteredProducts().map((p) => (
                                        <Picker.Item
                                            key={p.product_id}
                                            label={`${p.name} (Stock: ${p.stock})`}
                                            value={p.product_id}
                                        />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Quantity *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter quantity"
                                keyboardType="number-pad"
                                value={formData.quantity}
                                onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                            />

                            <Text style={styles.label}>Reason *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={formData.reason}
                                    onValueChange={(value) => setFormData({ ...formData, reason: value })}
                                    style={styles.picker}
                                >
                                    {STOCK_OUT_REASONS.map((reason) => (
                                        <Picker.Item
                                            key={reason}
                                            label={reason.charAt(0).toUpperCase() + reason.slice(1)}
                                            value={reason}
                                        />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={styles.label}>Unit</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., kg, liters, pieces"
                                value={formData.unit}
                                onChangeText={(text) => setFormData({ ...formData, unit: text })}
                            />

                            <Text style={styles.label}>Supplier</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter supplier name"
                                value={formData.supplier}
                                onChangeText={(text) => setFormData({ ...formData, supplier: text })}
                            />

                            <Text style={styles.label}>Date</Text>
                            <View style={styles.dateRow}>
                                <TextInput
                                    style={[styles.input, styles.dateInput]}
                                    placeholder="MM/DD/YYYY"
                                    keyboardType="number-pad"
                                    value={formatDateInputValue(
                                        formData.date_month,
                                        formData.date_day,
                                        formData.date_year
                                    )}
                                    onChangeText={handleDateInputChange}
                                    maxLength={10}
                                />
                                <TouchableOpacity style={styles.calendarButton} onPress={() => setDatePickerVisible(true)}>
                                    <FontAwesome5 name="calendar" size={18} color={COLORS.primary} />
                                </TouchableOpacity>
                            </View>

                            <Modal visible={datePickerVisible} transparent animationType="slide" onRequestClose={() => setDatePickerVisible(false)}>
                                <TouchableWithoutFeedback onPress={() => setDatePickerVisible(false)}>
                                    <View style={styles.backdrop} />
                                </TouchableWithoutFeedback>
                                <View style={styles.dateModalContainer}>
                                    <View style={styles.dateModalSheet}>
                                        <View style={styles.modalHeader}>
                                            <Text style={styles.modalTitle}>Select Date</Text>
                                            <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                                                <Ionicons name="close" size={24} color={COLORS.text} />
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.datePickerRow}>
                                            <View style={styles.datePickerItem}>
                                                <Text style={styles.filterLabel}>Month</Text>
                                                <Picker
                                                    selectedValue={formData.date_month}
                                                    onValueChange={(value) => updateDatePart('date_month', value)}
                                                    style={styles.picker}
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => {
                                                        const month = String(i + 1).padStart(2, '0');
                                                        return <Picker.Item key={month} label={month} value={month} />;
                                                    })}
                                                </Picker>
                                            </View>
                                            <View style={styles.datePickerItem}>
                                                <Text style={styles.filterLabel}>Day</Text>
                                                <Picker
                                                    selectedValue={formData.date_day}
                                                    onValueChange={(value) => updateDatePart('date_day', value)}
                                                    style={styles.picker}
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => {
                                                        const day = String(i + 1).padStart(2, '0');
                                                        return <Picker.Item key={day} label={day} value={day} />;
                                                    })}
                                                </Picker>
                                            </View>
                                            <View style={styles.datePickerItem}>
                                                <Text style={styles.filterLabel}>Year</Text>
                                                <Picker
                                                    selectedValue={formData.date_year}
                                                    onValueChange={(value) => updateDatePart('date_year', value)}
                                                    style={styles.picker}
                                                >
                                                    {Array.from({ length: 11 }, (_, i) => {
                                                        const year = String(today.getFullYear() - 5 + i);
                                                        return <Picker.Item key={year} label={year} value={year} />;
                                                    })}
                                                </Picker>
                                            </View>
                                        </View>
                                        <View style={styles.modalActions}>
                                            <TouchableOpacity style={styles.submitBtn} onPress={() => setDatePickerVisible(false)}>
                                                <Text style={styles.submitBtnText}>Done</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </Modal>

                            <Text style={styles.label}>Notes</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Additional notes..."
                                multiline
                                numberOfLines={4}
                                value={formData.notes}
                                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                                textAlignVertical="top"
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, processing && { opacity: 0.6 }]}
                                onPress={handleAddStockOut}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <Text style={styles.submitBtnText}>Record Stock Out</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    actionBar: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    filterControl: {
        flexBasis: '48%',
        minWidth: '48%',
    },
    fullWidthFilter: {
        flexBasis: '100%',
        minWidth: '100%',
    },
    filterLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '600',
        marginBottom: 6,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: COLORS.white,
        fontWeight: '600',
        fontSize: 14,
    },
    statsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
        flexWrap: 'wrap',
    },
    statsCard: {
        flexBasis: '48%',
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statsIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statsValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    statsLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '600',
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
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
    },
    listContentGrow: {
        flexGrow: 1,
    },
    recordCard: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.danger,
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    recordProductName: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        flex: 1,
    },
    recordQuantity: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.danger,
    },
    recordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    recordLabel: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    recordValue: {
        fontSize: 12,
        color: COLORS.text,
        flex: 1,
        textAlign: 'right',
    },
    reasonBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    reasonText: {
        fontSize: 11,
        fontWeight: '600',
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
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    modalSheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    formContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        marginBottom: 16,
        overflow: 'hidden',
    },
    picker: {
        height: 50,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: COLORS.text,
        marginBottom: 16,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dateInput: {
        flex: 1,
        marginBottom: 0,
    },
    calendarButton: {
        marginLeft: 8,
        width: 48,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
    },
    textArea: {
        minHeight: 100,
    },
    modalActions: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    submitBtn: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.white,
    },
});
