import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl, StatusBar,
    Modal, Animated, Dimensions, TouchableWithoutFeedback,
    ScrollView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
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

export default function StockInHistoryScreen({ navigation, route }) {
    const { user } = route.params || {};
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [allTransactions, setAllTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [filterProduct, setFilterProduct] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [statsValues, setStatsValues] = useState({ total: 0, totalUnits: 0, uniqueSuppliers: 0, thisMonth: 0 });

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const updateSummary = (transactions) => {
        const total = transactions.length;
        const totalUnits = transactions.reduce((sum, t) => sum + (parseInt(t.quantity) || 0), 0);
        const uniqueSuppliers = new Set(transactions.map(t => t.supplier).filter(s => s));
        
        const now = new Date();
        const thisMonth = transactions.filter(t => {
            if (!t.date_received) return false;
            const date = new Date(t.date_received);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length;
        
        setStatsValues({ total, totalUnits, uniqueSuppliers: uniqueSuppliers.size, thisMonth });
    };

    const loadTransactions = useCallback(async () => {
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/stock-in/history/`);
            const transactions = data.records || [];
            setAllTransactions(transactions);
            setFilteredTransactions(transactions);
            updateSummary(transactions);
        } catch (err) {
            console.error('Failed to load transactions:', err);
            Alert.alert('Error', 'Failed to load stock in history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const applyFilters = () => {
        let filtered = [...allTransactions];
        
        if (selectedDate) {
            const dateStr = selectedDate.toISOString().split('T')[0];
            filtered = filtered.filter(t => t.date_received && t.date_received.split('T')[0] === dateStr);
        }
        if (filterProduct) {
            filtered = filtered.filter(t => (t.product_name || '').toLowerCase().includes(filterProduct.toLowerCase()));
        }
        if (filterSupplier) {
            filtered = filtered.filter(t => (t.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase()));
        }
        
        updateSummary(filtered);
        setFilteredTransactions(filtered);
    };

    const filterByMonth = () => {
        let filtered = [...allTransactions];
        
        filtered = filtered.filter(t => {
            if (!t.date_received) return false;
            const date = new Date(t.date_received);
            return date.getMonth() === selectedMonth;
        });
        
        if (filterProduct) {
            filtered = filtered.filter(t => (t.product_name || '').toLowerCase().includes(filterProduct.toLowerCase()));
        }
        if (filterSupplier) {
            filtered = filtered.filter(t => (t.supplier || '').toLowerCase().includes(filterSupplier.toLowerCase()));
        }
        
        updateSummary(filtered);
        setFilteredTransactions(filtered);
        setShowMonthPicker(false);
    };

    const resetFilters = () => {
        setSelectedDate(null);
        setFilterProduct('');
        setFilterSupplier('');
        setSelectedMonth(new Date().getMonth());
        updateSummary(allTransactions);
        setFilteredTransactions(allTransactions);
    };

    const clearDate = () => {
        setSelectedDate(null);
        applyFilters();
    };

    const setToday = () => {
        setSelectedDate(new Date());
        applyFilters();
    };

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    useEffect(() => {
        applyFilters();
    }, [selectedDate, filterProduct, filterSupplier]);

    const handleRefresh = () => {
        setRefreshing(true);
        loadTransactions();
    };

    const handleLogout = () => {
        closeDrawer();
        navigation.replace('Login');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    const formatDisplayDate = (date) => {
        if (!date) return '';
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    };

    const renderRecordCard = ({ item, index }) => (
        <View style={[styles.recordCard, index % 2 === 1 && styles.recordCardAlt]}>
            <View style={styles.cardHeader}>
                <View style={styles.productIcon}>
                    <FontAwesome5 name="box" size={14} color={C.primary} />
                </View>
                <Text style={styles.productName}>{item.product_name}</Text>
                <Text style={styles.quantityBadge}>+{item.quantity}</Text>
            </View>
            
            <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                    <FontAwesome5 name="calendar-alt" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Date Received:</Text>
                    <Text style={styles.detailValue}>{formatDate(item.date_received)}</Text>
                </View>
                <View style={styles.detailRow}>
                    <FontAwesome5 name="cubes" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Unit:</Text>
                    <Text style={styles.detailValue}>{item.unit || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                    <FontAwesome5 name="truck" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Supplier:</Text>
                    <Text style={styles.detailValue}>{item.supplier || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                    <FontAwesome5 name="user" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Received by:</Text>
                    <Text style={styles.detailValue}>{item.received_by_name || '—'}</Text>
                </View>
                <View style={styles.detailRow}>
                    <FontAwesome5 name="sticky-note" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Notes:</Text>
                    <Text style={styles.detailValue}>{item.notes || '—'}</Text>
                </View>
            </View>
        </View>
    );

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
                            { icon: 'boxes', label: 'Inventory', onPress: () => { closeDrawer(); navigation.navigate('Inventory', { user }); } },  
                            { icon: 'arrow-circle-down', label: 'Stock In', onPress: () => { closeDrawer(); navigation.navigate('StockIn', { user }); } },
                            { icon: 'arrow-circle-up', label: 'Stock Out', onPress: () => { closeDrawer(); navigation.navigate('StockOut', { user }); } },
                            { icon: 'history', label: 'Stock In History', onPress: closeDrawer },
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
                    <FontAwesome5 name="history" size={18} color={C.dark} style={{ marginRight: 10 }} />
                    <Text style={styles.pageTitle}>Stock In History</Text>
                </View>

                {/* Summary Cards */}
                <View style={styles.summaryCards}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="truck" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Stock In Records</Text>
                            <Text style={styles.summaryValue}>{statsValues.total}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="cubes" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Units Received</Text>
                            <Text style={styles.summaryValue}>{statsValues.totalUnits}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="truck-loading" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Suppliers</Text>
                            <Text style={styles.summaryValue}>{statsValues.uniqueSuppliers}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="calendar-alt" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>This Month</Text>
                            <Text style={styles.summaryValue}>{statsValues.thisMonth}</Text>
                        </View>
                    </View>
                </View>

                {/* Search Filters */}
                <View style={styles.searchFilters}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search product..."
                        placeholderTextColor={C.gray}
                        value={filterProduct}
                        onChangeText={setFilterProduct}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search supplier..."
                        placeholderTextColor={C.gray}
                        value={filterSupplier}
                        onChangeText={setFilterSupplier}
                    />
                </View>

                {/* Date Filter with Calendar Picker */}
                <TouchableOpacity 
                    style={styles.dateFilterButton} 
                    onPress={() => setShowDatePicker(true)}
                >
                    <FontAwesome5 name="calendar-alt" size={14} color={C.primary} />
                    <Text style={[styles.dateFilterText, selectedDate && { color: C.dark, fontWeight: '500' }]}>
                        {selectedDate ? formatDisplayDate(selectedDate) : 'mm/dd/yyyy'}
                    </Text>
                    {selectedDate && (
                        <TouchableOpacity onPress={clearDate} style={styles.clearDateBtn}>
                            <Ionicons name="close-circle" size={16} color={C.gray} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                {/* Month Filter */}
<TouchableOpacity 
    style={styles.monthFilterButton} 
    onPress={() => setShowMonthPicker(true)}
>
    <FontAwesome5 name="calendar-alt" size={14} color={C.primary} />
    <Text style={styles.monthFilterText}>
        {monthNames[selectedMonth]} {new Date().getFullYear()} ▼
    </Text>
</TouchableOpacity>

               

                {/* Action Buttons: Clear and Today */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.clearBtn} onPress={resetFilters}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.todayBtn} onPress={setToday}>
                        <Text style={styles.todayBtnText}>Today</Text>
                    </TouchableOpacity>
                </View>

                {/* Date Picker Modal */}
                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            setShowDatePicker(false);
                            if (date) setSelectedDate(date);
                        }}
                        maximumDate={new Date()}
                        accentColor={C.primary}
                    />
                )}

                {/* Month Picker Modal */}
                <Modal visible={showMonthPicker} transparent animationType="slide">
                    <TouchableWithoutFeedback onPress={() => setShowMonthPicker(false)}>
                        <View style={styles.monthPickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.monthPickerContainer}>
                        <View style={styles.monthPickerHeader}>
                            <Text style={styles.monthPickerTitle}>Select Month</Text>
                            <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                                <Ionicons name="close" size={24} color={C.dark} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.monthPickerList}>
                            {monthNames.map((month, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.monthOption, selectedMonth === idx && styles.monthOptionActive]}
                                    onPress={() => {
                                        setSelectedMonth(idx);
                                        filterByMonth();
                                    }}
                                >
                                    <Text style={[styles.monthOptionText, selectedMonth === idx && styles.monthOptionTextActive]}>
                                        {month}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Modal>

                {/* Records Cards List */}
                {filteredTransactions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome5 name="inbox" size={48} color={C.light} />
                        <Text style={styles.emptyText}>No stock in records found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredTransactions}
                        keyExtractor={(item, index) => item.stock_in_id?.toString() || index.toString()}
                        renderItem={renderRecordCard}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl 
                                refreshing={refreshing} 
                                onRefresh={handleRefresh}
                                colors={[C.primary]}
                                tintColor={C.primary}
                            />
                        }
                        scrollEnabled={false}
                    />
                )}
            </ScrollView>
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
    pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    pageTitle: { fontSize: 20, fontWeight: '700', color: C.dark },

    // Summary Cards
    summaryCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
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

    // Search Filters
    searchFilters: { gap: 10, marginBottom: 12 },
    searchInput: {
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: C.dark,
    },

    // Date Filter
    dateFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        gap: 10,
    },
    dateFilterText: { flex: 1, fontSize: 14, color: C.gray },
    clearDateBtn: { paddingHorizontal: 4 },

    // Month Filter
    monthFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 12,
        gap: 10,
    },
    monthFilterText: { flex: 1, fontSize: 14, color: C.dark, fontWeight: '500' },

    // Action Buttons
    actionButtons: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    clearBtn: {
        flex: 1,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    clearBtnText: { color: C.text, fontWeight: '600', fontSize: 14 },
    todayBtn: {
        flex: 1,
        backgroundColor: C.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    todayBtnText: { color: C.white, fontWeight: '600', fontSize: 14 },

    // Month Picker Modal
    monthPickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    monthPickerContainer: {
        backgroundColor: C.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    monthPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    monthPickerTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
    monthPickerList: { paddingHorizontal: 20, paddingVertical: 10 },
    monthOption: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.light,
    },
    monthOptionActive: { backgroundColor: C.primaryLight, borderRadius: 8, paddingHorizontal: 12 },
    monthOptionText: { fontSize: 15, color: C.text },
    monthOptionTextActive: { color: C.primary, fontWeight: '700' },

    // Record Cards
    listContent: { paddingBottom: 20 },
    recordCard: {
        backgroundColor: C.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        elevation: 2,
    },
    recordCardAlt: { backgroundColor: '#fafffe' },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.light,
    },
    productIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
    productName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.dark },
    quantityBadge: { fontSize: 14, fontWeight: '800', color: C.primary },
    cardDetails: { gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { fontSize: 12, color: C.gray, width: 100 },
    detailValue: { flex: 1, fontSize: 13, color: C.dark, fontWeight: '500' },

    // Empty State
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 14, color: C.gray },
});