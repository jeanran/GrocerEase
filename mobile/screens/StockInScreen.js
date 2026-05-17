import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
import API_URL from '../config';
import { fetchJson } from '../utils/api';

const C = {
    primary:  '#1e6f5c',
    dark:     '#2c3e50',
    gray:     '#95a5a6',
    light:    '#e9ecef',
    white:    '#ffffff',
    danger:   '#e74c3c',
    warning:  '#f39c12',
    success:  '#27ae60',
    bg:       '#f0f2f5',
    border:   '#ddd',
    muted:    '#7f8c8d',
};

const { width: SW } = Dimensions.get('window');
const DRAWER_W = Math.min(SW * 0.72, 280);
const UNITS = ['pieces','packs','boxes','sacks','bottles','cans','kg','liters','dozen','trays'];

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function StockInScreen({ navigation, route }) {
    const { user, productToRestock } = route.params || {};

    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products,   setProducts]   = useState([]);
    const [processing, setProcessing] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [alert,      setAlert]      = useState(null);

    const [form, setForm] = useState({
        product_id:    productToRestock?.product_id || '',
        quantity:      '',
        unit:          productToRestock?.unit || 'pieces',
        supplier:      '',
        notes:         '',
        date_received: todayISO(),
    });

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
    const openDrawer  = () => { setDrawerOpen(true);  Animated.timing(drawerX,{toValue:0,       duration:260,useNativeDriver:true}).start(); };
    const closeDrawer = () => { Animated.timing(drawerX,{toValue:-DRAWER_W,duration:220,useNativeDriver:true}).start(()=>setDrawerOpen(false)); };

    const showAlert = (msg, type='success') => {
        setAlert({msg,type});
        setTimeout(()=>setAlert(null),4000);
    };

    const loadData = useCallback(async () => {
        try {
            const res = await fetchJson(`${API_URL}/api/mobile/products/`);
            if (res.success) setProducts(res.products||[]);
        } catch(e) { showAlert(e.message,'error'); }
        finally { setLoading(false); setRefreshing(false); }
    },[]);

    useEffect(()=>{ loadData(); },[loadData]);

    const onProductChange = (pid) => {
        const p = products.find(x=>String(x.product_id)===String(pid));
        setForm(f=>({...f, product_id:pid, unit:p?.unit||f.unit}));
    };

    const selectedProduct = products.find(p=>String(p.product_id)===String(form.product_id));

    const handleSubmit = async () => {
        if (!form.product_id) { showAlert('Please select a product','error'); return; }
        const qty = parseInt(form.quantity,10);
        if (isNaN(qty)||qty<1) { showAlert('Please enter a valid quantity','error'); return; }
        if (!form.date_received) { showAlert('Please select a date','error'); return; }

        setProcessing(true);
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/stock-in/add/`, {
                method:'POST',
                body: JSON.stringify({
                    product_id:    form.product_id,
                    quantity:      qty,
                    unit:          form.unit,
                    supplier:      form.supplier,
                    date_received: form.date_received,
                    notes:         form.notes,
                    user_id:       user?.user_id,
                }),
            });
            if (data.success) {
                showAlert(`✓ Successfully added ${qty} ${form.unit} to inventory!`,'success');
                handleClear();
                loadData();
            } else showAlert(data.message||'Something went wrong','error');
        } catch(e) { showAlert('Error: '+e.message,'error'); }
        finally { setProcessing(false); }
    };

    const handleClear = () => setForm({
        product_id:'', quantity:'', unit:'pieces',
        supplier:'', notes:'', date_received:todayISO(),
    });

    const onRefresh    = () => { setRefreshing(true); loadData(); };
    const handleLogout = () => { closeDrawer(); navigation.replace('Login'); };

    // ── entire page as one FlatList item — no nesting ────────────────
    const renderItem = () => (
        <View style={s.pageWrap}>

            {/* page-header — "↓ Record Stock In   Add new stock..." */}
            <View style={s.pageHeader}>
                <View style={s.pageHeaderLeft}>
                    <FontAwesome5 name="arrow-circle-down" size={20} color={C.dark} style={{marginRight:10}}/>
                    <Text style={s.pageHeaderTitle}>Record Stock In</Text>
                </View>
                <Text style={s.pageHeaderSub}>Add new stock to increase product inventory</Text>
            </View>

            {/* stockin-card — white rounded card */}
            <View style={s.stockinCard}>

                {/* alert */}
                {alert && (
                    <View style={[s.alertBox, alert.type==='success'?s.alertSuccess:s.alertError]}>
                        <FontAwesome5
                            name={alert.type==='success'?'check-circle':'exclamation-circle'}
                            size={14}
                            color={alert.type==='success'?'#155724':'#721c24'}
                            style={{marginRight:8}}/>
                        <Text style={[s.alertText, {color:alert.type==='success'?'#155724':'#721c24'}]}>
                            {alert.msg}
                        </Text>
                    </View>
                )}

                {/* Product * */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="box" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Product *</Text>
                    </View>
                    <View style={s.pickerWrap}>
                        <Picker selectedValue={form.product_id} onValueChange={onProductChange} style={s.picker}>
                            <Picker.Item label="-- Select Product --" value=""/>
                            {products.map(p=>(
                                <Picker.Item key={p.product_id} label={p.name} value={p.product_id}/>
                            ))}
                        </Picker>
                    </View>
                    {/* stock-info green box */}
                    <View style={s.stockInfo}>
                        <Text style={s.stockInfoText}>
                            Current stock: {selectedProduct
                                ? `${selectedProduct.stock} ${selectedProduct.unit||''}`
                                : '—'}
                        </Text>
                    </View>
                </View>

                {/* Quantity * */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="sort-amount-up" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Quantity *</Text>
                    </View>
                    <TextInput style={s.input} placeholder="Enter quantity"
                        keyboardType="number-pad" value={form.quantity}
                        onChangeText={v=>setForm(f=>({...f,quantity:v}))}/>
                </View>

                {/* Unit */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="cubes" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Unit</Text>
                    </View>
                    <View style={s.pickerWrap}>
                        <Picker selectedValue={form.unit}
                            onValueChange={v=>setForm(f=>({...f,unit:v}))} style={s.picker}>
                            {UNITS.map(u=>(
                                <Picker.Item key={u}
                                    label={u==='kg'?'Kilograms (kg)':u.charAt(0).toUpperCase()+u.slice(1)}
                                    value={u}/>
                            ))}
                        </Picker>
                    </View>
                </View>

                {/* Supplier */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="truck" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Supplier</Text>
                    </View>
                    <TextInput style={s.input} placeholder="Enter supplier name"
                        value={form.supplier}
                        onChangeText={v=>setForm(f=>({...f,supplier:v}))}/>
                </View>

                {/* Date Received * */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="calendar-alt" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Date Received *</Text>
                    </View>
                    <TextInput style={s.input} placeholder="YYYY-MM-DD"
                        value={form.date_received}
                        onChangeText={v=>setForm(f=>({...f,date_received:v}))}/>
                </View>

                {/* Notes */}
                <View style={s.formGroup}>
                    <View style={s.labelRow}>
                        <FontAwesome5 name="sticky-note" size={13} color={C.primary} style={{marginRight:6}}/>
                        <Text style={s.label}>Notes (optional)</Text>
                    </View>
                    <TextInput style={[s.input,s.textarea]}
                        placeholder="Additional notes..."
                        multiline numberOfLines={3} textAlignVertical="top"
                        value={form.notes}
                        onChangeText={v=>setForm(f=>({...f,notes:v}))}/>
                </View>

                {/* form-actions — green Record + gray Clear */}
                <View style={s.formActions}>
                    <TouchableOpacity
                        style={[s.btnRecord, processing&&{opacity:0.7}]}
                        onPress={handleSubmit} disabled={processing}>
                        {processing
                            ? <ActivityIndicator size="small" color={C.white}/>
                            : <>
                                <FontAwesome5 name="save" size={14} color={C.white} style={{marginRight:8}}/>
                                <Text style={s.btnRecordText}>Record Stock In</Text>
                              </>
                        }
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnClear} onPress={handleClear}>
                        <FontAwesome5 name="undo-alt" size={14} color="#555" style={{marginRight:8}}/>
                        <Text style={s.btnClearText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (loading) return (
        <SafeAreaView style={s.root}>
            <ActivityIndicator size="large" color={C.primary} style={{marginTop:40}}/>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.primary}/>

            {/* DRAWER */}
            {drawerOpen && (
                <Modal transparent animationType="none" onRequestClose={closeDrawer}>
                    <TouchableWithoutFeedback onPress={closeDrawer}>
                        <View style={s.backdrop}/>
                    </TouchableWithoutFeedback>
                    <Animated.View style={[s.drawer,{transform:[{translateX:drawerX}]}]}>
                        <View style={s.drawerLogo}>
                            <View style={s.drawerLogoIcon}>
                                <FontAwesome5 name="store" size={18} color={C.white}/>
                            </View>
                            <Text style={s.drawerLogoText}>
                                Grocer<Text style={{color:C.warning}}>Ease</Text>
                            </Text>
                        </View>
                        {[
                            {icon:'tachometer-alt',   label:'Dashboard',        onPress:()=>{closeDrawer();navigation.goBack();}},
                            {icon:'boxes',            label:'Stocks',           onPress:()=>{closeDrawer();navigation.navigate('Stocks',{user});}},
                            {icon:'layer-group',      label:'Inventory',        onPress:()=>{closeDrawer();navigation.navigate('Inventory',{user});}},
                            {icon:'arrow-circle-down',label:'Stock In',         onPress:closeDrawer},
                            {icon:'arrow-circle-up',  label:'Stock Out',        onPress:()=>{closeDrawer();navigation.navigate('StockOut',{user});}},
                            {icon:'history',          label:'Stock In History', onPress:()=>{closeDrawer();navigation.navigate('StockInHistory',{user});}},
                            {icon:'users',            label:'Manage Users',     onPress:()=>{closeDrawer();navigation.navigate('Users',{user});}},
                        ].map((item,idx)=>(
                            <TouchableOpacity key={idx} style={s.navItem} onPress={item.onPress}>
                                <FontAwesome5 name={item.icon} size={15} color={C.white}/>
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

            {/* NAVBAR */}
            <View style={s.navbar}>
                <TouchableOpacity onPress={openDrawer} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <MaterialIcons name="menu" size={26} color={C.white}/>
                </TouchableOpacity>
                <View style={s.navCenter}>
                    <FontAwesome5 name="store" size={14} color={C.white} style={{marginRight:6}}/>
                    <Text style={s.navTitle}>GrocerEase</Text>
                </View>
                <View style={s.navUser}>
                    <FontAwesome5 name="user-circle" size={16} color={C.white}/>
                    <Text style={s.navUsername}>{user?.username||'Admin'}</Text>
                </View>
            </View>

            {/* SINGLE FLATLIST — form as one item, no nesting */}
            <FlatList
                data={[{key:'form'}]}
                keyExtractor={i=>i.key}
                renderItem={renderItem}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                        colors={[C.primary]} tintColor={C.primary}/>
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom:32}}
                keyboardShouldPersistTaps="handled"
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    root:    {flex:1,backgroundColor:C.bg},
    backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.45)'},

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

    // matches web .stockin-container
    pageWrap: {paddingHorizontal:16,paddingTop:20,paddingBottom:8},

    // matches web .page-header
    pageHeader:    {marginBottom:20},
    pageHeaderLeft:{flexDirection:'row',alignItems:'center',marginBottom:4},
    pageHeaderTitle:{fontSize:22,fontWeight:'700',color:C.dark},
    pageHeaderSub: {fontSize:13,color:C.muted,marginLeft:30},

    // matches web .stockin-card
    stockinCard:{
        backgroundColor:C.white,
        borderRadius:16,
        padding:24,
        shadowColor:'#000',
        shadowOpacity:0.08,
        shadowRadius:12,
        shadowOffset:{width:0,height:4},
        elevation:3,
    },

    // matches web .alert
    alertBox:      {flexDirection:'row',alignItems:'center',padding:12,borderRadius:8,marginBottom:16,borderWidth:1},
    alertSuccess:  {backgroundColor:'#d4edda',borderColor:'#c3e6cb'},
    alertError:    {backgroundColor:'#f8d7da',borderColor:'#f5c6cb'},
    alertText:     {fontSize:13,flex:1},

    // matches web .form-group
    formGroup:{marginBottom:20},
    labelRow: {flexDirection:'row',alignItems:'center',marginBottom:8},
    label:    {fontSize:13,fontWeight:'600',color:C.dark},

    // matches web input/select
    input:    {
        borderWidth:1,borderColor:'#ddd',borderRadius:8,
        paddingHorizontal:12,paddingVertical:12,
        fontSize:14,color:C.dark,backgroundColor:C.white,
    },
    textarea: {minHeight:90,textAlignVertical:'top'},
    pickerWrap:{borderWidth:1,borderColor:'#ddd',borderRadius:8,overflow:'hidden',backgroundColor:C.white},
    picker:   {height:50},

    // matches web .stock-info
    stockInfo:    {backgroundColor:'#e8f5f0',padding:10,borderRadius:6,marginTop:8},
    stockInfoText:{fontSize:13,color:C.primary},

    // matches web .form-actions
    formActions:  {flexDirection:'row',gap:12,marginTop:25},
    btnRecord:    {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:C.primary,paddingVertical:14,borderRadius:8},
    btnRecordText:{color:C.white,fontSize:15,fontWeight:'600'},
    btnClear:     {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:'#f1f1f1',paddingVertical:14,borderRadius:8},
    btnClearText: {color:'#555',fontSize:15,fontWeight:'600'},
});