import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StatusBar,
    Modal,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    Platform,
    ScrollView,  
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
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

const { width: SW } = Dimensions.get('window');
const DRAWER_W = Math.min(SW * 0.72, 280);
const UNITS   = ['pieces','packs','boxes','sacks','bottles','cans','kg','liters','dozen','trays'];
const REASONS = ['sold','damaged','expired','returned'];

const reasonBadge = (r) => ({
    sold:     {bg:'#d4edda', color:'#155724'},
    damaged:  {bg:'#f8d7da', color:'#721c24'},
    expired:  {bg:'#fff3cd', color:'#856404'},
    returned: {bg:'#d1ecf1', color:'#0c5460'},
}[r] || {bg:C.light, color:C.dark});

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
};

const formatDateForAPI = (date) => {
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

function StockOutScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [loading,      setLoading]      = useState(true);
    const [refreshing,   setRefreshing]   = useState(false);
    const [products,     setProducts]     = useState([]);
    const [records,      setRecords]      = useState([]);
    const [processing,   setProcessing]   = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [drawerOpen,   setDrawerOpen]   = useState(false);
    
    const [filterDate,   setFilterDate]   = useState('');
    const [filterReason, setFilterReason] = useState('');
    const [filterSearch, setFilterSearch] = useState('');
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());

    const [form, setForm] = useState({
        product_id:'', quantity:'', unit:'pieces',
        reason:'sold', date:todayISO(), notes:'',
    });

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
    const openDrawer  = () => { setDrawerOpen(true);  Animated.timing(drawerX,{toValue:0, duration:260, useNativeDriver:true}).start(); };
    const closeDrawer = () => { Animated.timing(drawerX,{toValue:-DRAWER_W, duration:220, useNativeDriver:true}).start(()=>setDrawerOpen(false)); };

    const loadData = useCallback(async () => {
        try {
            const [pr, rr] = await Promise.allSettled([
                fetchJson(`${API_URL}/api/mobile/products/`),
                fetchJson(`${API_URL}/api/mobile/stock-out/`),
            ]);
            if (pr.status==='fulfilled' && pr.value.success) setProducts(pr.value.products||[]);
            if (rr.status==='fulfilled' && rr.value.success) setRecords(rr.value.records||[]);
        } catch(e) { Alert.alert('Error', e.message); }
        finally { setLoading(false); setRefreshing(false); }
    },[]);

    useEffect(()=>{ loadData(); },[loadData]);

    const onProductChange = (pid) => {
        const p = products.find(x=>String(x.product_id)===String(pid));
        setForm(f=>({...f, product_id:pid, unit:p?.unit||f.unit}));
    };
    const selectedProduct = products.find(p=>String(p.product_id)===String(form.product_id));

    const openModal  = () => { 
        setForm({
            product_id:'', quantity:'', unit:'pieces',
            reason:'sold', date:todayISO(), notes:''
        }); 
        setModalVisible(true); 
    };
    const closeModal = () => { setModalVisible(false); setProcessing(false); };

    const handleSubmit = async () => {
        if (!form.product_id) { Alert.alert('Validation','Please select a product.'); return; }
        const qty = parseInt(form.quantity,10);
        if (isNaN(qty)||qty<1) { Alert.alert('Validation','Please enter a valid quantity.'); return; }
        if (selectedProduct && qty > selectedProduct.stock) {
            Alert.alert('Not enough stock!',`Current stock is ${selectedProduct.stock}.`); return;
        }
        setProcessing(true);
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/stock-out/add/`, {
                method:'POST',
                body: JSON.stringify({
                    product_id:form.product_id, quantity:qty,
                    unit:form.unit, reason:form.reason,
                    date:form.date, notes:form.notes, user_id:user?.user_id,
                }),
            });
            if (data.success) { 
                Alert.alert('Success','Stock Out recorded successfully!'); 
                closeModal(); 
                loadData(); 
            }
            else Alert.alert('Error', data.message||'Something went wrong.');
        } catch(e) { Alert.alert('Error', e.message); }
        finally { setProcessing(false); }
    };

    const onRefresh    = () => { setRefreshing(true); loadData(); };
    const handleLogout = () => { closeDrawer(); navigation.replace('Login'); };

    const onDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const formattedDate = formatDateForAPI(selectedDate);
            setFilterDate(formattedDate);
            setTempDate(selectedDate);
        }
    };

    const clearDateFilter = () => {
        setFilterDate('');
        setTempDate(new Date());
    };

    const totalSold    = records.reduce((sum, r) => sum + (r.reason === 'sold' ? (parseInt(r.quantity) || 0) : 0), 0);
    const totalDamaged = records.reduce((sum, r) => sum + (r.reason === 'damaged' ? (parseInt(r.quantity) || 0) : 0), 0);
    const totalExpired = records.reduce((sum, r) => sum + (r.reason === 'expired' ? (parseInt(r.quantity) || 0) : 0), 0);
    const totalRecords = records.length;

    const filtered = records.filter(r => {
        if (filterSearch && !r.product_name?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        if (filterDate && !r.date?.startsWith(filterDate)) return false;
        if (filterReason && r.reason !== filterReason) return false;
        return true;
    });

    const renderRecordCard = ({ item, index }) => {
        const rb = reasonBadge(item.reason);
        const reasonLabel = item.reason === 'returned' ? 'Returned' : item.reason?.charAt(0).toUpperCase() + item.reason?.slice(1);
        
        return (
            <View style={[styles.recordCard, index % 2 === 1 && styles.recordCardAlt]}>
                <View style={styles.cardHeader}>
                    <View style={styles.productIcon}>
                        <FontAwesome5 name="box" size={14} color={C.primary} />
                    </View>
                    <Text style={styles.productName}>{item.product_name}</Text>
                    <Text style={styles.quantityBadge}>-{item.quantity}</Text>
                </View>
                
                <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name="calendar-alt" size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>{formatDisplayDate(item.date)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name="cubes" size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Unit:</Text>
                        <Text style={styles.detailValue}>{item.unit || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                    <FontAwesome5 name="user" size={12} color={C.gray} />
                    <Text style={styles.detailLabel}>Recorded By:</Text>
                    <Text style={styles.detailValue}>{item.recorded_by_name || '—'}</Text>
                </View>
                    <View style={styles.detailRow}>
                        <FontAwesome5 name={item.reason === 'sold' ? 'shopping-cart' : (item.reason === 'damaged' ? 'exclamation-triangle' : 'clock')} size={12} color={C.gray} />
                        <Text style={styles.detailLabel}>Reason:</Text>
                        <View style={[styles.reasonBadge, { backgroundColor: rb.bg }]}>
                            <Text style={[styles.reasonText, { color: rb.color }]}>{reasonLabel}</Text>
                        </View>
                    </View>
                    {item.notes && (
                        <View style={styles.detailRow}>
                            <FontAwesome5 name="sticky-note" size={12} color={C.gray} />
                            <Text style={styles.detailLabel}>Notes:</Text>
                            <Text style={styles.detailValue}>{item.notes}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    if (loading) return (
        <SafeAreaView style={styles.root}>
            <ActivityIndicator size="large" color={C.primary} style={{marginTop:40}}/>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.primary}/>

            {showDatePicker && (
                <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    maximumDate={new Date()}
                    accentColor={C.primary}
                    themeVariant="light"
                />
            )}

            {/* DRAWER */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={styles.backdrop}/>
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.drawer,{transform:[{translateX:drawerX}]}]}>
                        <View style={styles.drawerLogo}>
                            <View style={styles.drawerLogoIcon}>
                                <FontAwesome5 name="store" size={18} color={C.white}/>
                            </View>
                            <Text style={styles.drawerLogoText}>
                                Grocer<Text style={{color:C.warning}}>Ease</Text>
                            </Text>
                        </View>
                        {[
                            {icon:'tachometer-alt', label:'Dashboard', onPress:()=>{closeDrawer(); navigation.navigate('AdminDashboard',{user});}},
                            {icon:'boxes', label:'Stocks', onPress:()=>{closeDrawer(); navigation.navigate('Stocks',{user});}},
                            {icon:'layer-group', label:'Inventory', onPress:()=>{closeDrawer(); navigation.navigate('Inventory',{user});}},
                            {icon:'arrow-circle-down', label:'Stock In', onPress:()=>{closeDrawer(); navigation.navigate('StockIn',{user});}},
                            {icon:'arrow-circle-up', label:'Stock Out', onPress:closeDrawer},
                            {icon:'history', label:'Stock In History', onPress:()=>{closeDrawer(); navigation.navigate('StockInHistory',{user});}},
                            {icon:'users', label:'Manage Users', onPress:()=>{closeDrawer(); navigation.navigate('Users',{user});}},
                        ].map((item,idx)=>(
                            <TouchableOpacity key={idx} style={styles.navItem} onPress={item.onPress}>
                                <FontAwesome5 name={item.icon} size={15} color={C.white}/>
                                <Text style={styles.navItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={C.danger}/>
                            <Text style={styles.drawerLogoutText}>Logout</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}

            {/* NAVBAR */}
            <View style={styles.navbar}>
                <TouchableOpacity onPress={openDrawer} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <MaterialIcons name="menu" size={26} color={C.white}/>
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <FontAwesome5 name="store" size={14} color={C.white} style={{marginRight:6}}/>
                    <Text style={styles.navTitle}>GrocerEase</Text>
                </View>
                <View style={styles.navUser}>
                    <FontAwesome5 name="user-circle" size={16} color={C.white}/>
                    <Text style={styles.navUsername}>{user?.username||'Admin'}</Text>
                </View>
            </View>

            {/* MAIN CONTENT */}
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                
                {/* Page Header */}
                <View style={styles.pageHeader}>
                    <View style={styles.pageHeaderLeft}>
                        <FontAwesome5 name="arrow-circle-up" size={20} color={C.dark} style={{marginRight:10}}/>
                        <Text style={styles.pageHeaderTitle}>Stock Out</Text>
                    </View>
                    <TouchableOpacity style={styles.btnAdd} onPress={openModal}>
                        <FontAwesome5 name="plus" size={13} color={C.white} style={{marginRight:7}}/>
                        <Text style={styles.btnAddText}>Record Stock Out</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary Cards - 2x2 Grid */}
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="shopping-bag" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Sold</Text>
                            <Text style={styles.summaryValue}>{totalSold}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="box-open" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Damaged</Text>
                            <Text style={styles.summaryValue}>{totalDamaged}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="calendar-times" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Expired</Text>
                            <Text style={styles.summaryValue}>{totalExpired}</Text>
                        </View>
                    </View>
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryIcon}>
                            <FontAwesome5 name="chart-line" size={18} color={C.white} />
                        </View>
                        <View style={styles.summaryInfo}>
                            <Text style={styles.summaryLabel}>Total Records</Text>
                            <Text style={styles.summaryValue}>{totalRecords}</Text>
                        </View>
                    </View>
                </View>

                {/* Filters */}
                <View style={styles.filtersContainer}>
                    <TouchableOpacity 
                        style={styles.dateFilterButton} 
                        onPress={() => setShowDatePicker(true)}
                    >
                        <FontAwesome5 name="calendar-alt" size={14} color={C.primary} />
                        <Text style={[styles.dateFilterText, filterDate && {color: C.primary, fontWeight: '600'}]}>
                            {filterDate ? formatDisplayDate(filterDate) : 'mm/dd/yyyy'}
                        </Text>
                        {filterDate && (
                            <TouchableOpacity onPress={clearDateFilter} style={styles.clearDateBtn}>
                                <Ionicons name="close-circle" size={16} color={C.gray} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>

                    <View style={[styles.pickerWrap, {flex:1}]}>
                        <Picker 
                            selectedValue={filterReason}
                            onValueChange={setFilterReason} 
                            style={styles.picker}
                            dropdownIconColor={C.primary}
                        >
                            <Picker.Item label="All Reasons" value=""/>
                            <Picker.Item label="Sold" value="sold"/>
                            <Picker.Item label="Damaged" value="damaged"/>
                            <Picker.Item label="Expired" value="expired"/>
                            <Picker.Item label="Returned" value="returned"/>
                        </Picker>
                    </View>
                </View>

                <TextInput style={styles.filterSearch}
                    placeholder="Search product..."
                    placeholderTextColor={C.gray}
                    value={filterSearch} 
                    onChangeText={setFilterSearch}
                />

                {/* Records Cards List */}
                {filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome5 name="inbox" size={48} color={C.light} />
                        <Text style={styles.emptyText}>No stock out records found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={item => item.stock_out_id}
                        renderItem={renderRecordCard}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl 
                                refreshing={refreshing} 
                                onRefresh={onRefresh}
                                colors={[C.primary]}
                                tintColor={C.primary}
                            />
                        }
                        scrollEnabled={false}
                    />
                )}
            </ScrollView>

            {/* RECORD STOCK OUT MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.backdrop}/>
                </TouchableWithoutFeedback>
                <View style={styles.modalWrap}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHead}>
                            <Text style={styles.modalTitle}>Record Stock Out</Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color={C.dark}/>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={[{key:'f'}]}
                            keyExtractor={i=>i.key}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            renderItem={()=>(
                                <View style={styles.modalBody}>
                                    <Text style={styles.modalLabel}>Product</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker selectedValue={form.product_id}
                                            onValueChange={onProductChange} style={styles.picker}>
                                            <Picker.Item label="-- Select Product --" value=""/>
                                            {products.map(p=>(
                                                <Picker.Item key={p.product_id}
                                                    label={`${p.name} (Stock: ${p.stock})`}
                                                    value={p.product_id}/>
                                            ))}
                                        </Picker>
                                    </View>

                                    {selectedProduct && (
                                        <View style={styles.stockInfo}>
                                            <Text style={styles.stockInfoText}>
                                                Current Stock:{' '}
                                                <Text style={{fontWeight:'700'}}>
                                                    {selectedProduct.stock} {selectedProduct.unit||''}
                                                </Text>
                                            </Text>
                                        </View>
                                    )}

                                    <Text style={styles.modalLabel}>Quantity</Text>
                                    <TextInput style={styles.input} placeholder="Enter quantity"
                                        keyboardType="number-pad" value={form.quantity}
                                        onChangeText={v=>setForm(f=>({...f,quantity:v}))}/>

                                    <Text style={styles.modalLabel}>Unit</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker selectedValue={form.unit}
                                            onValueChange={v=>setForm(f=>({...f,unit:v}))} style={styles.picker}>
                                            {UNITS.map(u=>(
                                                <Picker.Item key={u}
                                                    label={u==='kg'?'Kilograms (kg)':u.charAt(0).toUpperCase()+u.slice(1)}
                                                    value={u}/>
                                            ))}
                                        </Picker>
                                    </View>

                                    <Text style={styles.modalLabel}>Reason</Text>
                                    <View style={styles.pickerWrap}>
                                        <Picker selectedValue={form.reason}
                                            onValueChange={v=>setForm(f=>({...f,reason:v}))} style={styles.picker}>
                                            <Picker.Item label="Sold" value="sold"/>
                                            <Picker.Item label="Damaged" value="damaged"/>
                                            <Picker.Item label="Expired" value="expired"/>
                                            <Picker.Item label="Returned to Supplier" value="returned"/>
                                        </Picker>
                                    </View>

                                    <Text style={styles.modalLabel}>Date</Text>
                                    <TextInput style={styles.input} placeholder="YYYY-MM-DD"
                                        value={form.date}
                                        onChangeText={v=>setForm(f=>({...f,date:v}))}/>

                                    <Text style={styles.modalLabel}>Notes (optional)</Text>
                                    <TextInput style={[styles.input,styles.textarea]}
                                        placeholder="Additional notes..."
                                        multiline numberOfLines={3} textAlignVertical="top"
                                        value={form.notes}
                                        onChangeText={v=>setForm(f=>({...f,notes:v}))}/>

                                    <View style={styles.modalActions}>
                                        <TouchableOpacity
                                            style={[styles.btnRecord,processing&&{opacity:0.7}]}
                                            onPress={handleSubmit} disabled={processing}>
                                            {processing
                                                ?<ActivityIndicator size="small" color={C.white}/>
                                                :<Text style={styles.btnRecordText}>Record</Text>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.btnCancel} onPress={closeModal}>
                                            <Text style={styles.btnCancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{height:20}}/>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root:    {flex:1, backgroundColor:C.bg},
    backdrop:{...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.45)'},

    drawer:        {position:'absolute',top:0,left:0,bottom:0,width:DRAWER_W,backgroundColor:'#1e2d3d',paddingTop:56,zIndex:99,elevation:6},
    drawerLogo:    {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:28,gap:12},
    drawerLogoIcon:{width:38,height:38,borderRadius:10,backgroundColor:C.primary,alignItems:'center',justifyContent:'center'},
    drawerLogoText:{fontSize:20,fontWeight:'800',color:C.white},
    navItem:       {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:13,backgroundColor:'rgba(255,255,255,0.07)',marginHorizontal:12,borderRadius:10,marginBottom:6},
    navItemText:   {color:C.white,fontSize:14,fontWeight:'500'},
    drawerLogout:  {flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:20,paddingVertical:14,marginTop:16,marginHorizontal:12},
    drawerLogoutText:{color:C.danger,fontSize:14,fontWeight:'600'},

    navbar:    {backgroundColor:C.primary,paddingTop:48,paddingBottom:12,paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',elevation:4},
    navCenter: {flexDirection:'row',alignItems:'center'},
    navTitle:  {fontSize:18,fontWeight:'800',color:C.white},
    navUser:   {flexDirection:'row',alignItems:'center',gap:6},
    navUsername:{color:C.white,fontSize:12,fontWeight:'600'},

    container: { flex: 1, padding: 16 },

    // Page Header
    pageHeader:    {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},
    pageHeaderLeft:{flexDirection:'row',alignItems:'center'},
    pageHeaderTitle:{fontSize:22,fontWeight:'700',color:C.dark},
    btnAdd:        {flexDirection:'row',alignItems:'center',backgroundColor:C.primary,paddingHorizontal:14,paddingVertical:10,borderRadius:8,elevation:1},
    btnAddText:    {color:C.white,fontWeight:'700',fontSize:13},

    // Summary Cards - 2x2 Grid
    summaryGrid: {flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:20},
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

    // Filters
    filtersContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    dateFilterButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    dateFilterText: { flex: 1, fontSize: 13, color: C.gray },
    clearDateBtn: { paddingHorizontal: 4 },
    pickerWrap:   {borderWidth:1,borderColor:C.border,borderRadius:8,overflow:'hidden',backgroundColor:C.white},
    picker:       {height:50},
    filterSearch: {marginBottom:12,borderWidth:1,borderColor:C.border,borderRadius:8,paddingHorizontal:12,paddingVertical:12,fontSize:13,color:C.dark,backgroundColor:C.white},

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
    quantityBadge: { fontSize: 14, fontWeight: '800', color: C.danger },
    cardDetails: { gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    detailLabel: { fontSize: 12, color: C.gray, width: 55 },
    detailValue: { flex: 1, fontSize: 13, color: C.dark, fontWeight: '500' },
    reasonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    reasonText: { fontSize: 10, fontWeight: '700' },

    // Empty State
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { marginTop: 12, fontSize: 14, color: C.gray },

    // Modal
    modalWrap:  {flex:1,justifyContent:'flex-end'},
    modalSheet: {backgroundColor:C.white,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:'90%',elevation:10},
    modalHead:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
    modalTitle: {fontSize:18,fontWeight:'700',color:C.dark},
    modalBody:  {paddingHorizontal:20,paddingTop:16},
    modalLabel: {fontSize:13,fontWeight:'600',color:C.dark,marginBottom:8,marginTop:4},
    input:      {borderWidth:1,borderColor:C.border,borderRadius:8,paddingHorizontal:12,paddingVertical:12,fontSize:14,color:C.dark,backgroundColor:C.white,marginBottom:14},
    textarea:   {minHeight:80,textAlignVertical:'top'},
    stockInfo:  {backgroundColor:'#e8f5f0',padding:10,borderRadius:6,marginBottom:14},
    stockInfoText:{fontSize:13,color:C.primary},
    modalActions:{flexDirection:'row',gap:12,marginTop:8,marginBottom:8},
    btnRecord:   {flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.primary,paddingVertical:13,borderRadius:8},
    btnRecordText:{color:C.white,fontWeight:'700',fontSize:14},
    btnCancel:   {flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f1f1f1',paddingVertical:13,borderRadius:8},
    btnCancelText:{color:'#555',fontWeight:'600',fontSize:14},
});

export default StockOutScreen;