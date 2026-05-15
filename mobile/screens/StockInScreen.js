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

export default function StockInScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [records, setRecords] = useState([]);
    const [products, setProducts] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [filterProductSearch, setFilterProductSearch] = useState('');
    const [filterSupplierSearch, setFilterSupplierSearch] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDateText, setFilterDateText] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [datePickerVisible, setDatePickerVisible] = useState(false);

    const today = new Date();
    const initialYear = String(today.getFullYear());
    const initialMonth = String(today.getMonth() + 1).padStart(2, '0');
    const initialDay = String(today.getDate()).padStart(2, '0');

    const [formData, setFormData] = useState({
        product_id: '',
        quantity: '',
        supplier: '',
        unit: 'pieces',
        notes: '',
        date_received: `${initialYear}-${initialMonth}-${initialDay}`,
        date_received_year: initialYear,
        date_received_month: initialMonth,
        date_received_day: initialDay,
    });

    const loadData = useCallback(async () => {
        try {
            const [recordsResult, productsResult] = await Promise.allSettled([
                fetchJson(`${API_URL}/api/mobile/stock-in/`),
                fetchJson(`${API_URL}/api/mobile/products/`),
            ]);

            if (recordsResult.status === 'fulfilled' && recordsResult.value.success) {
                setRecords(recordsResult.value.records || []);
            } else if (recordsResult.status === 'rejected') {
                Alert.alert('Error', 'Failed to load stock-in records: ' + recordsResult.reason.message);
                console.warn('Stock in records load failed:', recordsResult.reason);
            }

            if (productsResult.status === 'fulfilled' && productsResult.value.success) {
                setProducts(productsResult.value.products || []);
            } else if (productsResult.status === 'rejected') {
                Alert.alert('Error', 'Failed to load products: ' + productsResult.reason.message);
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
            supplier: '',
            unit: 'pieces',
            notes: '',
            date_received: `${year}-${month}-${day}`,
            date_received_year: year,
            date_received_month: month,
            date_received_day: day,
        });
        setDatePickerVisible(false);
        setModalVisible(true);
    };

    const closeForm = () => {
        setModalVisible(false);
        setProcessing(false);
    };

    const updateDateReceivedPart = (part, value) => {
        const cleaned = value.replace(/\D/g, '');
        const normalized = part === 'date_received_year'
            ? cleaned.slice(0, 4)
            : cleaned.slice(0, 2);
        setFormData((prev) => {
            const next = { ...prev, [part]: normalized };
            const year = next.date_received_year;
            const month = next.date_received_month.padStart(2, '0');
            const day = next.date_received_day.padStart(2, '0');
            if (year.length === 4 && month.length === 2 && day.length === 2) {
                next.date_received = `${year}-${month}-${day}`;
            } else {
                next.date_received = '';
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

    const handleDateReceivedInputChange = (text) => {
        const digits = text.replace(/\D/g, '').slice(0, 8);
        const month = digits.slice(0, 2);
        const day = digits.slice(2, 4);
        const year = digits.slice(4, 8);
        setFormData((prev) => ({
            ...prev,
            date_received_month: month,
            date_received_day: day,
            date_received_year: year,
            date_received: (
                month.length === 2 && day.length === 2 && year.length === 4
            ) ? `${year}-${month}-${day}` : '',
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

    const handleAddStockIn = async () => {
        if (!formData.product_id || !formData.quantity) {
            Alert.alert('Validation', 'Product and quantity are required.');
            return;
        }

        setProcessing(true);
        try {
            const response = await fetch(`${API_URL}/api/mobile/stock-in/add/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: formData.product_id,
                    quantity: parseInt(formData.quantity, 10),
                    supplier: formData.supplier,
                    unit: formData.unit,
                    notes: formData.notes,
                    date_received: formData.date_received,
                    user_id: user?.user_id,
                }),
            });

            const data = await response.json();
            if (data.success) {
                Alert.alert('Success', data.message || 'Stock In recorded successfully.');
                closeForm();
                setRefreshing(true);
                loadData();
            } else {
                Alert.alert('Error', data.message || 'Failed to record stock in.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setProcessing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const calculateStats = (items = records) => {
        const today = new Date();
        const totalRecords = items.length;
        const totalUnits = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
        const totalSuppliers = new Set(items.map(item => item.supplier).filter(Boolean)).size;
        const thisMonthCount = items.filter(item => {
            if (!item.date_received) return false;
            const date = new Date(item.date_received);
            return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        }).length;
        return { totalRecords, totalUnits, totalSuppliers, thisMonthCount };
    };

    const renderStatsCard = (title, value, icon) => (
        <View style={styles.statsCard}>
            <View style={styles.statsIconContainer}>
                <FontAwesome5 name={icon} size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.statsValue}>{value}</Text>
            <Text style={styles.statsLabel}>{title}</Text>
        </View>
    );

    const renderStatsLabel = (title, value, icon) => (
        <View style={styles.statsCard}>
            <View style={styles.statsIconContainer}>
                <FontAwesome5 name={icon} size={20} color={COLORS.primary} />
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
            if (filterMonth) {
                if (!item.date_received) return false;
                const month = String(new Date(item.date_received).getMonth() + 1);
                matches = matches && month === filterMonth;
            }
            return matches;
        });
    };

    const filteredRecords = getFilteredRecords();

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
                <Text style={styles.recordLabel}>Date:</Text>
                <Text style={styles.recordValue}>{formatDate(item.date_received)}</Text>
            </View>
            <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Received by:</Text>
                <Text style={styles.recordValue}>{item.received_by_name || 'Unknown'}</Text>
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
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Stock In</Text>
                </View>
                <View style={{ width: 26 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Product *</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={formData.product_id}
                            onValueChange={(value) => {
                                setFormData({ ...formData, product_id: value });
                                const prod = products.find(p => p.product_id.toString() === value.toString());
                                if (prod) {
                                    setFormData(prev => ({ ...prev, unit: prod.unit || 'pieces' }));
                                }
                            }}
                            style={styles.picker}
                        >
                            <Picker.Item label="-- Select Product --" value="" />
                            {products.map((p) => (
                                <Picker.Item key={p.product_id} label={p.name} value={p.product_id} />
                            ))}
                        </Picker>
                    </View>
                    <Text style={styles.fieldNote}>Current stock: {products.find(p => p.product_id === formData.product_id)?.stock ?? '—'}</Text>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Quantity *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter quantity"
                        keyboardType="number-pad"
                        value={formData.quantity}
                        onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Unit</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Pieces"
                        value={formData.unit}
                        onChangeText={(text) => setFormData({ ...formData, unit: text })}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Supplier</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter supplier name"
                        value={formData.supplier}
                        onChangeText={(text) => setFormData({ ...formData, supplier: text })}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Date Received *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="MM/DD/YYYY"
                        keyboardType="number-pad"
                        value={formatDateInputValue(
                            formData.date_received_month,
                            formData.date_received_day,
                            formData.date_received_year
                        )}
                        onChangeText={handleDateReceivedInputChange}
                        maxLength={10}
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Notes (optional)</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Additional notes..."
                        multiline
                        numberOfLines={4}
                        value={formData.notes}
                        onChangeText={(text) => setFormData({ ...formData, notes: text })}
                        textAlignVertical="top"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, processing && { opacity: 0.7 }]}
                    onPress={handleAddStockIn}
                    disabled={processing}
                >
                    {processing ? (
                        <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                        <Text style={styles.submitButtonText}>Record Stock In</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
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
    },
    statsCard: {
        flex: 1,
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
        backgroundColor: COLORS.primaryLight,
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
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
    },
    recordCard: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
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
        color: COLORS.success,
    },
    recordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
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
