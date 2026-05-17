import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, ScrollView, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';
import { fetchJson } from '../utils/api';

const C = {
    primary:  '#1e6f5c',
    secondary:'#0e5545',
    dark:     '#2c3e50',
    gray:     '#95a5a6',
    light:    '#e9ecef',
    white:    '#ffffff',
    danger:   '#e74c3c',
    warning:  '#f39c12',
    success:  '#27ae60',
    bg:       '#f0f2f5',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);
const CHART_W  = SCREEN_W - 48;

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function AdminDashboard({ navigation, route }) {
    const { user } = route.params || {};

    const [loading,             setLoading]             = useState(true);
    const [refreshing,          setRefreshing]          = useState(false);
    const [stats,               setStats]               = useState({ total_products:0, low_stock:0, total_transactions:0, today_sales:0 });
    const [weeklyData,          setWeeklyData]          = useState([]);
    const [monthlyData,         setMonthlyData]         = useState([]);
    const [selectedMonth,       setSelectedMonth]       = useState(new Date().getMonth());
    const [currentMonth,        setCurrentMonth]        = useState(new Date().getMonth());
    const [products,            setProducts]            = useState([]);
    const [lowStockProducts,    setLowStockProducts]    = useState([]);
    const [stockOutProducts,    setStockOutProducts]    = useState([]);
    const [recentTransactions,  setRecentTransactions]  = useState([]);
    const [selectedProduct,     setSelectedProduct]     = useState(null);
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [adjustmentType,      setAdjustmentType]      = useState('in');
    const [adjustmentQty,       setAdjustmentQty]       = useState('');
    const [processingUpdate,    setProcessingUpdate]    = useState(false);
    const [drawerOpen,          setDrawerOpen]          = useState(false);
    
    // Offline Notes States
    const [notesModalVisible, setNotesModalVisible] = useState(false);
    const [offlineNotes, setOfflineNotes] = useState([]);
    const [noteForm, setNoteForm] = useState({
        title: '',
        content: '',
        product_name: '',
    });
    const [savingNote, setSavingNote] = useState(false);

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer  = () => { setDrawerOpen(true);  Animated.timing(drawerX,{toValue:0, duration:260, useNativeDriver:true}).start(); };
    const closeDrawer = () => { Animated.timing(drawerX,{toValue:-DRAWER_W, duration:220, useNativeDriver:true}).start(()=>setDrawerOpen(false)); };

    // ── Offline Notes Functions ──────────────────────────────────────
    const loadOfflineNotes = async () => {
        try {
            const savedNotes = await AsyncStorage.getItem('@inventory_notes');
            if (savedNotes) {
                const notes = JSON.parse(savedNotes);
                const pendingNotes = notes.filter(n => n.status === 'pending').slice(0, 3);
                setOfflineNotes(pendingNotes);
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    };

    const saveOfflineNote = async () => {
        if (!noteForm.title || !noteForm.content) {
            Alert.alert('Validation', 'Please enter title and content');
            return;
        }

        setSavingNote(true);
        try {
            const savedNotes = await AsyncStorage.getItem('@inventory_notes');
            let allNotes = savedNotes ? JSON.parse(savedNotes) : [];
            
            const newNote = {
                id: Date.now().toString(),
                ...noteForm,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            allNotes = [newNote, ...allNotes];
            await AsyncStorage.setItem('@inventory_notes', JSON.stringify(allNotes));
            
            const pendingNotes = allNotes.filter(n => n.status === 'pending').slice(0, 3);
            setOfflineNotes(pendingNotes);
            
            Alert.alert('Success', 'Note saved offline! Will sync when online.');
            setNoteForm({ title: '', content: '', product_name: '' });
            setNotesModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to save note');
        } finally {
            setSavingNote(false);
        }
    };

    const deleteOfflineNote = async (noteId) => {
        Alert.alert('Delete Note', 'Remove this inventory note?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const savedNotes = await AsyncStorage.getItem('@inventory_notes');
                        let allNotes = savedNotes ? JSON.parse(savedNotes) : [];
                        allNotes = allNotes.filter(n => n.id !== noteId);
                        await AsyncStorage.setItem('@inventory_notes', JSON.stringify(allNotes));
                        
                        const pendingNotes = allNotes.filter(n => n.status === 'pending').slice(0, 3);
                        setOfflineNotes(pendingNotes);
                        Alert.alert('Success', 'Note deleted');
                    } catch (error) {
                        Alert.alert('Error', 'Failed to delete note');
                    }
                }
            }
        ]);
    };

    // ── load all dashboard data ──────────────────────────────────────
    const loadDashboardData = useCallback(async () => {
        try {
            const [summaryData, productsData, lowStockData, chartsData, txData] = await Promise.all([
                fetchJson(`${API_URL}/api/mobile/daily-summary/`),
                fetchJson(`${API_URL}/api/mobile/products/`),
                fetchJson(`${API_URL}/api/mobile/low-stock/`),
                fetchJson(`${API_URL}/api/mobile/charts/`),
                fetchJson(`${API_URL}/api/mobile/transactions/`),
            ]);

            if (productsData.success) {
                const all = productsData.products || [];
                setProducts(all);
                setStockOutProducts(all.filter(p => p.stock <= 0));
                setStats(prev => ({ ...prev, total_products: all.length }));
            }
            if (summaryData.success) {
                setStats(prev => ({
                    ...prev,
                    low_stock:          summaryData.low_stock_alerts,
                    total_transactions: summaryData.total_transactions,
                    today_sales:        summaryData.total_sales,
                }));
            }
            if (lowStockData.success) setLowStockProducts(lowStockData.products || []);

            if (chartsData.success) {
                setWeeklyData(chartsData.weekly || []);
                setMonthlyData(chartsData.monthly || []);
                const cm = chartsData.current_month ?? new Date().getMonth();
                setCurrentMonth(cm);
                setSelectedMonth(prev => prev ?? cm);
            }

            // Load recent transactions
            if (txData.success) {
                const txs = (txData.transactions || []).slice(0, 5).map(t => ({
                    ...t,
                    short_id: String(t.transaction_id).slice(0, 8).toUpperCase(),
                }));
                setRecentTransactions(txs);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to load dashboard: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
            await loadOfflineNotes();
        }
    }, []);

    const loadMonthlyChart = useCallback(async (monthIdx) => {
        try {
            const res = await fetchJson(`${API_URL}/api/mobile/charts/?month=${monthIdx + 1}`);
            if (res.success) setMonthlyData(res.monthly || []);
        } catch (err) {
            console.warn('Monthly chart error:', err.message);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 30000);
        return () => clearInterval(interval);
    }, [loadDashboardData]);

    useEffect(() => {
        loadMonthlyChart(selectedMonth);
    }, [selectedMonth, loadMonthlyChart]);

    useEffect(() => {
        loadOfflineNotes();
    }, []);

    const onRefresh = () => { setRefreshing(true); loadDashboardData(); };

    const openProductModal = (product) => {
        setSelectedProduct(product); setAdjustmentType('in');
        setAdjustmentQty(''); setProductModalVisible(true);
    };
    const closeProductModal = () => {
        setProductModalVisible(false); setSelectedProduct(null);
        setAdjustmentQty(''); setProcessingUpdate(false);
    };

    const handleStockAdjustment = async () => {
        const quantity = parseInt(adjustmentQty, 10);
        if (!quantity || quantity <= 0) { Alert.alert('Validation','Enter a valid quantity.'); return; }
        const endpoint = adjustmentType === 'in'
            ? `${API_URL}/api/mobile/stock-in/add/`
            : `${API_URL}/api/mobile/stock-out/add/`;
        setProcessingUpdate(true);
        try {
            const data = await fetchJson(endpoint, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    user_id:    user?.user_id,
                    product_id: selectedProduct.product_id,
                    quantity,
                    unit:       selectedProduct.unit || 'pieces',
                    reason:     adjustmentType === 'out' ? 'adjustment' : undefined,
                }),
            });
            if (data.success) { Alert.alert('Success', data.message||'Stock updated.'); closeProductModal(); loadDashboardData(); }
            else Alert.alert('Error', data.message||'Unable to update stock.');
        } catch (err) { Alert.alert('Error', err.message); }
        finally { setProcessingUpdate(false); }
    };

    const handleRestock = (product) => {
        closeDrawer();
        navigation.navigate('StockIn', { user, productToRestock: { product_id:product.product_id, name:product.name, unit:product.unit||'pieces' } });
    };

    const handleLogout = () => { closeDrawer(); navigation.replace('Login'); };

    
const handleStockAlertPress = () => {

    
    closeDrawer();
    navigation.navigate('Inventory', { 
        user: user,
        filterType: 'low-stock'
    });
};

    const getStatus = (p) => {
        if (p.stock <= 0)                       return { label:'Out of Stock', style:s.badgeOut };
        if (p.stock <= (p.reorder_level || 10)) return { label:'Low Stock',    style:s.badgeLow };
        return                                         { label:'In Stock',     style:s.badgeIn  };
    };

    const chartConfig = {
        backgroundGradientFrom: C.white, backgroundGradientTo: C.white,
        color: (opacity=1) => `rgba(30,111,92,${opacity})`,
        strokeWidth:2, barPercentage:0.6, decimalPlaces:0,
        propsForDots:{ r:'4', strokeWidth:'2', stroke:C.primary },
        formatYLabel: v => `₱${parseFloat(v).toLocaleString()}`,
        propsForBackgroundLines:{ strokeDasharray:'', stroke:'#f0f2f5' },
    };

    const weeklyLabels = weeklyData.map(d => d.label);
    const weeklyTotals = weeklyData.map(d => Number(d.total) || 0);
    const hasWeekly    = weeklyTotals.some(v => v > 0);

    const allMonthlyTotals  = monthlyData.map(d => Number(d.total) || 0);
    const allMonthlyLabels  = monthlyData.map((d,i) => (i % 4 === 0 ? String(d.day) : ''));
    const hasMonthly        = allMonthlyTotals.some(v => v > 0);

    if (loading) return (
        <SafeAreaView style={s.loadingScreen}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={s.loadingText}>Loading Dashboard...</Text>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.primary} />

            {/* DRAWER */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={s.backdrop} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[s.drawer,{transform:[{translateX:drawerX}]}]}>
                        <View style={s.drawerLogo}>
                            <View style={s.drawerLogoIcon}><FontAwesome5 name="store" size={18} color={C.white}/></View>
                            <Text style={s.drawerLogoText}>Grocer<Text style={{color:C.warning}}>Ease</Text></Text>
                        </View>
                        {[
                            {icon:'tachometer-alt', label:'Dashboard', onPress:closeDrawer},
                            {icon:'boxes', label:'Stocks', onPress:()=>{closeDrawer();navigation.navigate('Stocks',{user});}}, 
                            {icon:'boxes', label:'Inventory', onPress:()=>{closeDrawer();navigation.navigate('Inventory',{user});}},
                            {icon:'arrow-circle-down', label:'Stock In', onPress:()=>{closeDrawer();navigation.navigate('StockIn',{user});}},
                            {icon:'arrow-circle-up', label:'Stock Out', onPress:()=>{closeDrawer();navigation.navigate('StockOut',{user});}},
                            {icon:'history', label:'Stock In History', onPress:()=>{closeDrawer();navigation.navigate('StockInHistory',{user});}},
                            {icon:'users', label:'Manage Users', onPress:()=>{closeDrawer();navigation.navigate('Users',{user});}},
                        ].map((item,idx)=>(
                            <TouchableOpacity key={idx} style={s.navItem} onPress={item.onPress}>
                                <FontAwesome5 name={item.icon} size={16} color={C.white}/>
                                <Text style={s.navItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={s.drawerLogout} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={C.danger}/>
                            <Text style={s.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}

            {/* NAVBAR with Notes Button */}
            <View style={s.navbar}>
                <TouchableOpacity onPress={openDrawer} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <MaterialIcons name="menu" size={26} color={C.white}/>
                </TouchableOpacity>
                <View style={s.navCenter}>
                    <FontAwesome5 name="store" size={14} color={C.white} style={{marginRight:6}}/>
                    <Text style={s.navTitle}>GrocerEase</Text>
                </View>
                <View style={s.navRight}>
                    <TouchableOpacity onPress={() => setNotesModalVisible(true)} style={s.noteNavBtn}>
                        <FontAwesome5 name="sticky-note" size={16} color={C.white} />
                        {offlineNotes.length > 0 && (
                            <View style={s.noteBadge}>
                                <Text style={s.noteBadgeText}>{offlineNotes.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={s.navUser}>
                        <FontAwesome5 name="user-circle" size={16} color={C.white}/>
                        <Text style={s.navUsername}>{user?.username||'Admin'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary}/>}>

                <View style={s.pageTitle}>
                    <FontAwesome5 name="tachometer-alt" size={18} color={C.dark} style={{marginRight:10}}/>
                    <Text style={s.pageTitleText}>Dashboard Overview</Text>
                </View>

                {/* Stock Alert Banner - FIXED: navigates to Inventory with low stock filter */}
                {(lowStockProducts.length > 0 || stockOutProducts.length > 0) && (
    <TouchableOpacity style={s.alertBanner} onPress={handleStockAlertPress} activeOpacity={0.9}>
                



    
                        <View style={s.alertBannerIcon}><FontAwesome5 name="exclamation-triangle" size={18} color={C.white}/></View>
                        <View style={{flex:1}}>
                            <Text style={s.alertBannerTitle}>Stock Alert!</Text>
                            <Text style={s.alertBannerMsg}>
                                {lowStockProducts.length > 0 && `${lowStockProducts.length} low stock`}
                                {lowStockProducts.length > 0 && stockOutProducts.length > 0 && ' · '}
                                {stockOutProducts.length > 0 && `${stockOutProducts.length} out of stock`}
                            </Text>
                        </View>
                        <FontAwesome5 name="chevron-right" size={14} color={C.white}/>
                    </TouchableOpacity>
                )}

                {/* STATS */}
                <View style={s.statsGrid}>
                    {[
                        {icon:'boxes', label:'TOTAL PRODUCTS', value:stats.total_products, color:C.primary},
                        {icon:'chart-line', label:"TODAY'S SALES", value:`₱${parseFloat(stats.today_sales||0).toFixed(2)}`, color:C.primary, small:true},
                        {icon:'exclamation-triangle', label:'LOW STOCK', value:stats.low_stock, color:stats.low_stock>0?C.warning:C.primary, iconBg:stats.low_stock>0?C.warning:C.primary},
                        {icon:'cash-register', label:'TRANSACTIONS', value:stats.total_transactions, color:C.primary},
                    ].map((item,i)=>(
                        <View key={i} style={s.statCard}>
                            <View style={[s.statIcon,{backgroundColor:item.iconBg||C.primary}]}>
                                <FontAwesome5 name={item.icon} size={20} color={C.white}/>
                            </View>
                            <View style={s.statInfo}>
                                <Text style={s.statLabel}>{item.label}</Text>
                                <Text style={[s.statNumber,item.small&&{fontSize:18},{color:item.color}]}>{item.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* CHARTS */}
                <View style={s.dashboardCharts}>
                    <View style={s.chartCard}>
                        <Text style={s.chartTitle}>Weekly Sales</Text>
                        {hasWeekly ? (
                            <LineChart
                                data={{labels:weeklyLabels, datasets:[{data:weeklyTotals.map(v=>v||0.001)}]}}
                                width={CHART_W} height={200}
                                chartConfig={chartConfig} bezier style={s.chart}
                                withInnerLines={true} withOuterLines={false}
                            />
                        ) : (
                            <View style={s.chartEmpty}><FontAwesome5 name="chart-line" size={28} color={C.light}/><Text style={s.chartEmptyText}>No sales this week</Text></View>
                        )}
                    </View>

                    <View style={s.chartCard}>
                        <Text style={s.chartTitle}>Monthly Sales</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.monthScroll}>
                            <View style={s.monthSelector}>
                                {monthNames.map((m,idx)=>(
                                    <TouchableOpacity key={idx}
                                        style={[s.monthOption, selectedMonth===idx && s.monthOptionActive]}
                                        onPress={()=>setSelectedMonth(idx)}>
                                        <Text style={[s.monthOptionText, selectedMonth===idx && s.monthOptionTextActive]}>{m}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        {hasMonthly && allMonthlyTotals.length > 0 ? (
                            <BarChart
                                data={{labels: allMonthlyLabels, datasets:[{data: allMonthlyTotals.map(v=>v||0)}]}}
                                width={CHART_W} height={200}
                                chartConfig={chartConfig} style={s.chart}
                                fromZero withInnerLines={true} withOuterLines={false}
                                showValuesOnTopOfBars={false}
                            />
                        ) : (
                            <View style={s.chartEmpty}>
                                <FontAwesome5 name="chart-bar" size={28} color={C.light}/>
                                <Text style={s.chartEmptyText}>No sales for {monthNames[selectedMonth]}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Low Stock */}
                {lowStockProducts.length > 0 && (
                    <View style={s.mobileCard}>
                        <View style={s.mobileCardHeader}>
                            <FontAwesome5 name="exclamation-triangle" size={16} color={C.warning}/>
                            <Text style={[s.mobileCardTitle,{color:C.warning}]}>Low Stock Alerts</Text>
                        </View>
                        {lowStockProducts.slice(0,5).map(p=>(
                            <View key={p.product_id} style={s.alertRow}>
                                <View style={[s.alertDot,{backgroundColor:'#fff3cd'}]}><FontAwesome5 name="cube" size={12} color={C.warning}/></View>
                                <View style={{flex:1}}>
                                    <Text style={s.alertName}>{p.name}</Text>
                                    <Text style={[s.alertStock,{color:C.warning}]}>Stock: {p.stock} {p.unit||''} · Reorder: {p.reorder_level||10}</Text>
                                </View>
                                <TouchableOpacity style={s.restockBtn} onPress={()=>handleRestock(p)}>
                                    <Text style={s.restockBtnText}>Restock</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                        {lowStockProducts.length > 5 && (
                            <TouchableOpacity onPress={()=>navigation.navigate('Inventory',{user})}>
                                <Text style={s.viewAll}>View all {lowStockProducts.length} items →</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Out of Stock */}
                {stockOutProducts.length > 0 && (
                    <View style={s.mobileCard}>
                        <View style={s.mobileCardHeader}>
                            <FontAwesome5 name="times-circle" size={16} color={C.danger}/>
                            <Text style={[s.mobileCardTitle,{color:C.danger}]}>Out of Stock</Text>
                        </View>
                        {stockOutProducts.slice(0,5).map(p=>(
                            <View key={p.product_id} style={s.alertRow}>
                                <View style={[s.alertDot,{backgroundColor:'#f8d7da'}]}><FontAwesome5 name="times" size={12} color={C.danger}/></View>
                                <View style={{flex:1}}>
                                    <Text style={s.alertName}>{p.name}</Text>
                                    <Text style={[s.alertStock,{color:C.danger}]}>Restock immediately!</Text>
                                </View>
                                <TouchableOpacity style={[s.restockBtn,{backgroundColor:C.danger}]} onPress={()=>handleRestock(p)}>
                                    <Text style={[s.restockBtnText,{color:C.white}]}>Restock</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Recent Transactions - ADDED BACK */}
                <View style={s.mobileCard}>
                    <View style={s.mobileCardHeader}>
                        <Ionicons name="time-outline" size={18} color={C.dark} />
                        <Text style={s.mobileCardTitle}>Recent Transactions</Text>
                    </View>
                    {recentTransactions.length === 0 ? (
                        <View style={s.empty}>
                            <Text style={s.emptyText}>No transactions yet.</Text>
                        </View>
                    ) : (
                        recentTransactions.map(t => (
                            <View key={t.transaction_id} style={s.transactionRow}>
                                <Text style={s.transactionId}>#{t.short_id}</Text>
                                <Text style={s.transactionDate}>{new Date(t.date).toLocaleDateString()}</Text>
                                <Text style={s.transactionTotal}>₱{parseFloat(t.total).toFixed(2)}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Recent Inventory Notes */}
                <View style={s.mobileCard}>
                    <View style={s.mobileCardHeader}>
                        <FontAwesome5 name="sticky-note" size={16} color={C.primary} />
                        <Text style={s.mobileCardTitle}>Recent Inventory Notes</Text>
                        <TouchableOpacity 
                            onPress={() => setNotesModalVisible(true)}
                            style={{ marginLeft: 'auto' }}
                        >
                            <FontAwesome5 name="plus" size={12} color={C.white} />
                            <Text style={s.viewAllNotes}> Add Note</Text>
                        </TouchableOpacity>
                    </View>

                    {offlineNotes.length === 0 ? (
                        <TouchableOpacity 
                            style={s.emptyNotes}
                            onPress={() => setNotesModalVisible(true)}
                        >
                            <FontAwesome5 name="plus-circle" size={24} color={C.gray} />
                            <Text style={s.emptyNotesText}>Add offline inventory note</Text>
                            <Text style={s.emptyNotesSubtext}>Notes save locally, sync when online</Text>
                        </TouchableOpacity>
                    ) : (
                        offlineNotes.map(note => (
                            <View key={note.id} style={s.noteItem}>
                                <View style={s.noteIcon}>
                                    <FontAwesome5 name="file-alt" size={14} color={C.primary} />
                                </View>
                                <View style={s.noteContent}>
                                    <Text style={s.noteTitle} numberOfLines={1}>{note.title}</Text>
                                    <Text style={s.notePreview} numberOfLines={2}>{note.content}</Text>
                                    {note.product_name ? (
                                        <Text style={s.noteProduct}>Product: {note.product_name}</Text>
                                    ) : null}
                                    <Text style={s.noteTime}>
                                        {new Date(note.timestamp).toLocaleString()}
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    style={s.noteDeleteBtn}
                                    onPress={() => deleteOfflineNote(note.id)}
                                >
                                    <FontAwesome5 name="trash" size={14} color={C.danger} />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>

                <Text style={s.footer}>© 2026 GrocerEase – Sales & Inventory System</Text>
                <View style={{height:24}}/>
            </ScrollView>

            {/* Product Modal */}
            <Modal visible={productModalVisible} transparent animationType="slide" onRequestClose={closeProductModal}>
                <TouchableWithoutFeedback onPress={closeProductModal}><View style={s.backdrop}/></TouchableWithoutFeedback>
                <View style={s.modalWrap}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHead}>
                            <Text style={s.modalTitle}>Product Details</Text>
                            <TouchableOpacity onPress={closeProductModal}><Ionicons name="close" size={24} color={C.dark}/></TouchableOpacity>
                        </View>
                        {selectedProduct && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {[
                                    {label:'Product', value:selectedProduct.name},
                                    {label:'Category', value:selectedProduct.category||'Uncategorized'},
                                    {label:'Unit', value:selectedProduct.unit||'—'},
                                    {label:'Reorder Level', value:String(selectedProduct.reorder_level||0)},
                                ].map((row,i)=>(
                                    <View key={i} style={s.modalRow}>
                                        <Text style={s.modalLabel}>{row.label}</Text>
                                        <Text style={s.modalValue}>{row.value}</Text>
                                    </View>
                                ))}
                                <View style={s.modalRow}>
                                    <Text style={s.modalLabel}>Current Stock</Text>
                                    <Text style={[s.modalValue,selectedProduct.stock<=0&&{color:C.danger}]}>
                                        {selectedProduct.stock} {selectedProduct.unit||''}
                                    </Text>
                                </View>
                                <View style={s.modalRow}>
                                    <Text style={s.modalLabel}>Status</Text>
                                    <Text style={[s.badge,getStatus(selectedProduct).style]}>{getStatus(selectedProduct).label}</Text>
                                </View>
                                <View style={s.modalDivider}/>
                                <Text style={s.adjustTitle}>Adjust Stock</Text>
                                <View style={s.adjustRow}>
                                    {['in','out'].map(type=>(
                                        <TouchableOpacity key={type}
                                            style={[s.adjustBtn,adjustmentType===type&&s.adjustBtnActive]}
                                            onPress={()=>setAdjustmentType(type)}>
                                            <FontAwesome5
                                                name={type==='in'?'arrow-circle-down':'arrow-circle-up'}
                                                size={14} color={adjustmentType===type?C.white:C.gray} style={{marginRight:8}}/>
                                            <Text style={[s.adjustBtnText,adjustmentType===type&&s.adjustBtnTextActive]}>
                                                Stock {type==='in'?'In':'Out'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput style={s.adjustInput} placeholder="Enter quantity"
                                    placeholderTextColor={C.gray} keyboardType="numeric"
                                    value={adjustmentQty} onChangeText={setAdjustmentQty}/>
                                <TouchableOpacity style={[s.applyBtn,processingUpdate&&{opacity:0.7}]}
                                    onPress={handleStockAdjustment} disabled={processingUpdate}>
                                    <Text style={s.applyBtnText}>{processingUpdate?'Updating...':'Apply Update'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Offline Inventory Notes Modal */}
            <Modal visible={notesModalVisible} transparent animationType="slide" onRequestClose={() => setNotesModalVisible(false)}>
                <TouchableWithoutFeedback onPress={() => setNotesModalVisible(false)}>
                    <View style={s.backdrop} />
                </TouchableWithoutFeedback>
                <View style={s.notesModalContainer}>
                    <View style={s.notesModalSheet}>
                        <View style={s.notesModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <FontAwesome5 name="sticky-note" size={20} color={C.primary} />
                                <Text style={s.notesModalTitle}>Inventory Note</Text>
                            </View>
                            <TouchableOpacity onPress={() => setNotesModalVisible(false)}>
                                <Ionicons name="close" size={24} color={C.dark} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={s.notesModalBody}>
                            <Text style={s.notesLabel}>Title *</Text>
                            <TextInput
                                style={s.notesInput}
                                placeholder="e.g., Stock Count, Damaged Item, Low Stock"
                                placeholderTextColor={C.gray}
                                value={noteForm.title}
                                onChangeText={(text) => setNoteForm({ ...noteForm, title: text })}
                            />

                            <Text style={s.notesLabel}>Product Name (optional)</Text>
                            <TextInput
                                style={s.notesInput}
                                placeholder="Which product is this about?"
                                placeholderTextColor={C.gray}
                                value={noteForm.product_name}
                                onChangeText={(text) => setNoteForm({ ...noteForm, product_name: text })}
                            />

                            <Text style={s.notesLabel}>Note Content *</Text>
                            <TextInput
                                style={[s.notesInput, s.notesTextArea]}
                                placeholder="Write your inventory note here..."
                                placeholderTextColor={C.gray}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                value={noteForm.content}
                                onChangeText={(text) => setNoteForm({ ...noteForm, content: text })}
                            />

                            <View style={s.offlineInfo}>
                                <FontAwesome5 name="wifi" size={14} color={C.warning} />
                                <Text style={s.offlineInfoText}>
                                    This note will be saved locally and synced when internet is available.
                                </Text>
                            </View>

                            <View style={s.notesModalActions}>
                                <TouchableOpacity 
                                    style={s.notesCancelBtn}
                                    onPress={() => setNotesModalVisible(false)}
                                >
                                    <Text style={s.notesCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[s.notesSaveBtn, savingNote && { opacity: 0.6 }]}
                                    onPress={saveOfflineNote}
                                    disabled={savingNote}
                                >
                                    {savingNote ? (
                                        <ActivityIndicator size="small" color={C.white} />
                                    ) : (
                                        <Text style={s.notesSaveText}>Save Offline</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root:         {flex:1,backgroundColor:C.bg},
    loadingScreen:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg},
    loadingText:  {marginTop:12,color:C.gray,fontSize:14},
    backdrop:     {...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.45)'},

    drawer:       {position:'absolute',top:0,left:0,bottom:0,width:DRAWER_W,backgroundColor:'#1e2d3d',paddingTop:56,zIndex:99,elevation:6},
    drawerLogo:   {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:28,gap:12},
    drawerLogoIcon:{width:38,height:38,borderRadius:10,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},
    drawerLogoText:{fontSize:20,fontWeight:'800',color:C.white},
    navItem:      {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:13,backgroundColor:'rgba(255,255,255,0.07)',marginHorizontal:12,borderRadius:10,marginBottom:6},
    navItemText:  {color:C.white,fontSize:14,fontWeight:'500'},
    drawerLogout: {flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingVertical:14,marginTop:16,marginHorizontal:12},
    drawerLogoutText:{color:C.danger,fontSize:14,fontWeight:'600'},

    navbar:       {backgroundColor:C.primary,paddingTop:48,paddingBottom:12,paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',elevation:4},
    navCenter:    {flexDirection:'row',alignItems:'center'},
    navTitle:     {fontSize:18,fontWeight:'800',color:C.white},
    navRight:     {flexDirection:'row',alignItems:'center',gap:12},
    noteNavBtn:   {position:'relative',padding:8},
    noteBadge:    {position:'absolute',top:-2,right:-2,backgroundColor:C.danger,borderRadius:10,minWidth:18,height:18,alignItems:'center',justifyContent:'center',paddingHorizontal:4},
    noteBadgeText:{color:C.white,fontSize:10,fontWeight:'700'},
    navUser:      {flexDirection:'row',alignItems:'center',gap:6},
    navUsername:  {color:C.white,fontSize:12,fontWeight:'600'},

    pageTitle:    {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingTop:16,paddingBottom:8},
    pageTitleText:{fontSize:20,fontWeight:'600',color:C.dark},

    alertBanner:  {flexDirection:'row',alignItems:'center',backgroundColor:C.danger,marginHorizontal:12,marginBottom:12,borderRadius:12,padding:14,elevation:2,gap:12},
    alertBannerIcon:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
    alertBannerTitle:{color:C.white,fontSize:14,fontWeight:'700'},
    alertBannerMsg:  {color:C.white,fontSize:12,opacity:0.9},

    statsGrid:    {paddingHorizontal:12,paddingVertical:8,gap:10},
    statCard:     {backgroundColor:C.white,borderRadius:12,padding:16,flexDirection:'row',alignItems:'center',gap:15,elevation:2},
    statIcon:     {width:52,height:52,borderRadius:26,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},
    statInfo:     {flex:1},
    statLabel:    {fontSize:10,fontWeight:'600',color:C.gray,marginBottom:4,letterSpacing:0.5},
    statNumber:   {fontSize:22,fontWeight:'700',color:C.dark},

    dashboardCharts:{paddingHorizontal:12,gap:14,marginTop:4,marginBottom:8},
    chartCard:    {backgroundColor:C.white,borderRadius:12,padding:16,elevation:2,overflow:'hidden'},
    chartTitle:   {fontSize:14,fontWeight:'700',color:C.dark,marginBottom:12,paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.light},
    chart:        {marginLeft:-16,borderRadius:8},
    chartEmpty:   {height:160,justifyContent:'center',alignItems:'center',backgroundColor:C.bg,borderRadius:8,gap:8},
    chartEmptyText:{color:C.gray,fontSize:13},

    monthScroll:  {marginBottom:12},
    monthSelector:{flexDirection:'row',gap:6,paddingVertical:2},
    monthOption:  {paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:C.bg,borderWidth:1,borderColor:C.light},
    monthOptionActive:{backgroundColor:C.primary,borderColor:C.primary},
    monthOptionText:  {fontSize:11,color:C.gray,fontWeight:'500'},
    monthOptionTextActive:{color:C.white,fontWeight:'700'},

    mobileCard:   {backgroundColor:C.white,borderRadius:12,marginHorizontal:12,marginBottom:12,padding:16,elevation:2},
    mobileCardHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12,paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.light},
    mobileCardTitle:{fontSize:14,fontWeight:'600',color:C.dark},

    alertRow:     {flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.light},
    alertDot:     {width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center'},
    alertName:    {fontSize:13,fontWeight:'600',color:C.dark},
    alertStock:   {fontSize:11,marginTop:2},
    restockBtn:   {backgroundColor:C.primary,paddingHorizontal:12,paddingVertical:6,borderRadius:8},
    restockBtnText:{color:C.white,fontSize:11,fontWeight:'700'},
    viewAll:      {textAlign:'center',color:C.primary,marginTop:12,fontSize:13,fontWeight:'500'},

    // Transaction Row Styles
    transactionRow: {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.light},
    transactionId:  {fontSize:13,fontWeight:'700',color:C.dark,flex:1},
    transactionDate: {fontSize:12,color:C.gray,flex:1.5},
    transactionTotal: {fontSize:13,fontWeight:'700',color:C.primary,flex:1,textAlign:'right'},

    // Notes Styles
    viewAllNotes: {
        fontSize: 12,
        fontWeight: '600',
        color: C.white,
        backgroundColor: C.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        overflow: 'hidden',
        textAlign: 'center',
    },
    emptyNotes:   {alignItems:'center',justifyContent:'center',paddingVertical:30,backgroundColor:C.bg,borderRadius:12,gap:8},
    emptyNotesText:{fontSize:14,fontWeight:'600',color:C.text},
    emptyNotesSubtext:{fontSize:11,color:C.gray},
    noteItem:     {flexDirection:'row',alignItems:'flex-start',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.light},
    noteIcon:     {width:36,height:36,borderRadius:18,backgroundColor:C.primaryLight,alignItems:'center',justifyContent:'center'},
    noteContent:  {flex:1},
    noteTitle:    {fontSize:14,fontWeight:'700',color:C.dark,marginBottom:4},
    notePreview:  {fontSize:12,color:C.gray,marginBottom:2},
    noteProduct:  {fontSize:11,color:C.primary,fontWeight:'500',marginBottom:2},
    noteTime:     {fontSize:10,color:C.gray,marginTop:2},
    noteDeleteBtn:{padding:8},

    notesModalContainer:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.3)'},
    notesModalSheet:{backgroundColor:C.white,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'90%'},
    notesModalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.light},
    notesModalTitle:{fontSize:18,fontWeight:'700',color:C.dark},
    notesModalBody:{paddingHorizontal:20,paddingTop:16,paddingBottom:20},
    notesLabel:   {fontSize:13,fontWeight:'600',color:C.dark,marginBottom:8,marginTop:8},
    notesInput:   {borderWidth:1,borderColor:C.light,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:C.dark,backgroundColor:C.white,marginBottom:16},
    notesTextArea:{minHeight:100,textAlignVertical:'top'},
    offlineInfo:  {flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fff3cd',padding:12,borderRadius:10,marginBottom:20},
    offlineInfoText:{flex:1,fontSize:12,color:'#856404'},
    notesModalActions:{flexDirection:'row',gap:12,marginTop:8,marginBottom:20},
    notesCancelBtn:{flex:1,paddingVertical:12,borderWidth:1,borderColor:C.light,borderRadius:10,alignItems:'center'},
    notesCancelText:{fontSize:14,fontWeight:'600',color:C.text},
    notesSaveBtn: {flex:1,backgroundColor:C.primary,paddingVertical:12,borderRadius:10,alignItems:'center'},
    notesSaveText:{fontSize:14,fontWeight:'600',color:C.white},

    badge:   {fontSize:10,fontWeight:'700',paddingHorizontal:8,paddingVertical:3,borderRadius:20,overflow:'hidden',textAlign:'center'},
    badgeIn: {backgroundColor:'#d4edda',color:'#155724'},
    badgeLow:{backgroundColor:'#fff3cd',color:'#856404'},
    badgeOut:{backgroundColor:'#f8d7da',color:'#721c24'},

    empty:    {paddingVertical:24,alignItems:'center'},
    emptyText:{color:C.gray,fontSize:13},
    footer:   {textAlign:'center',fontSize:11,color:C.gray,paddingVertical:8,marginTop:8},

    modalWrap:  {flex:1,justifyContent:'center',backgroundColor:'rgba(0,0,0,0.45)',padding:20},
    modalSheet: {backgroundColor:C.white,borderRadius:16,padding:20,maxHeight:'88%',elevation:8},
    modalHead:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
    modalTitle: {fontSize:18,fontWeight:'700',color:C.dark},
    modalRow:   {marginBottom:12},
    modalLabel: {fontSize:11,color:C.gray,marginBottom:4,fontWeight:'600',textTransform:'uppercase'},
    modalValue: {fontSize:15,color:C.dark,fontWeight:'600'},
    modalDivider:{height:1,backgroundColor:C.light,marginVertical:16},
    adjustTitle:{fontSize:14,fontWeight:'700',color:C.dark,marginBottom:10},
    adjustRow:  {flexDirection:'row',gap:10,marginBottom:12},
    adjustBtn:  {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:11,borderRadius:10,backgroundColor:C.bg,borderWidth:1,borderColor:C.light},
    adjustBtnActive:{backgroundColor:C.primary,borderColor:C.primary},
    adjustBtnText:{fontSize:13,fontWeight:'600',color:C.gray},
    adjustBtnTextActive:{color:C.white},
    adjustInput:{borderWidth:1,borderColor:C.light,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:C.dark,marginBottom:12,backgroundColor:C.bg},
    applyBtn:   {backgroundColor:C.primary,borderRadius:10,paddingVertical:13,alignItems:'center'},
    applyBtnText:{color:C.white,fontWeight:'700',fontSize:14},
});

export default AdminDashboard;