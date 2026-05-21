import { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, ScrollView, RefreshControl,
    StatusBar, Modal, Animated, Dimensions, TouchableWithoutFeedback,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialIcons, Ionicons } from '@expo/vector-icons';
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

const CATEGORIES = [
    'Rice & Grains','Oils & Cooking','Dairy & Eggs','Beverages',
    'Canned Goods','Bakery','Condiments','Snacks','Personal Care','Cleaning Supplies',
];
const UNITS = ['pieces','packs','boxes','sacks','bottles','cans','kg','liters','dozen','trays'];

export default function StocksScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [loading,       setLoading]       = useState(true);
    const [refreshing,    setRefreshing]    = useState(false);
    const [products,      setProducts]      = useState([]);
    const [search,        setSearch]        = useState('');
    const [drawerOpen,    setDrawerOpen]    = useState(false);
    const [modalVisible,  setModalVisible]  = useState(false);
    const [isEditing,     setIsEditing]     = useState(false);
    const [saving,        setSaving]        = useState(false);
    const [deleting,      setDeleting]      = useState(null);

    const [form, setForm] = useState({
        product_id:'', name:'', category:'Rice & Grains',
        unit:'pieces', price:'', stock:'', reorder_level:'10',
    });

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;
    const openDrawer  = () => { setDrawerOpen(true);  Animated.timing(drawerX,{toValue:0, duration:260,useNativeDriver:true}).start(); };
    const closeDrawer = () => { Animated.timing(drawerX,{toValue:-DRAWER_W,duration:220,useNativeDriver:true}).start(()=>setDrawerOpen(false)); };

    const loadProducts = useCallback(async () => {
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/products/`);
            if (data.success) setProducts(data.products || []);
        } catch (err) {
            Alert.alert('Error', 'Failed to load products: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadProducts(); }, [loadProducts]);
    const onRefresh = () => { setRefreshing(true); loadProducts(); };

    const totalProducts = products.length;
    const totalUnits    = products.reduce((s,p) => s + (p.stock||0), 0);
    const lowStock      = products.filter(p => p.stock > 0 && p.stock <= (p.reorder_level||10)).length;
    const outOfStock    = products.filter(p => p.stock <= 0).length;

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category||'').toLowerCase().includes(search.toLowerCase())
    );

    const getStatus = (p) => {
        if (p.stock <= 0)                       return { label:'Out of Stock', style:s.badgeOut };
        if (p.stock <= (p.reorder_level||10))   return { label:'Low Stock',    style:s.badgeLow };
        return                                         { label:'In Stock',     style:s.badgeIn  };
    };

    const openAdd = () => {
        setIsEditing(false);
        setForm({ product_id:'', name:'', category:'Rice & Grains', unit:'pieces', price:'', stock:'', reorder_level:'10' });
        setModalVisible(true);
    };

    const openEdit = (p) => {
        setIsEditing(true);
        setForm({
            product_id:   String(p.product_id),
            name:         p.name,
            category:     p.category || 'Rice & Grains',
            unit:         p.unit     || 'pieces',
            price:        String(p.price),
            stock:        String(p.stock),
            reorder_level:String(p.reorder_level||10),
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.price || !form.stock) {
            Alert.alert('Validation','Please fill in all required fields.');
            return;
        }
        setSaving(true);
        try {
            const token = user?.token || '';
            const url   = isEditing
                ? `${API_URL}/api/mobile/products/${form.product_id}/edit/`
                : `${API_URL}/api/mobile/products/add/`;

            const data = await fetchJson(url, {
                method:'POST',
                headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                body: JSON.stringify({
                    name:          form.name.trim(),
                    category:      form.category,
                    unit:          form.unit,
                    price:         parseFloat(form.price)||0,
                    stock:         parseInt(form.stock)||0,
                    reorder_level: parseInt(form.reorder_level)||10,
                }),
            });
            if (data.success) {
                setModalVisible(false);
                loadProducts();
                Alert.alert('Success', isEditing ? 'Product updated!' : 'Product added!');
            } else {
                Alert.alert('Error', data.message || 'Something went wrong.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (p) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${p.name}"?`,
            [
                { text:'Cancel', style:'cancel' },
                { text:'Delete', style:'destructive', onPress: async () => {
                    setDeleting(p.product_id);
                    try {
                        const token = user?.token || '';
                        const data  = await fetchJson(`${API_URL}/api/mobile/products/${p.product_id}/delete/`, {
                            method:'POST',
                            headers:{'Authorization':`Bearer ${token}`},
                        });
                        if (data.success) loadProducts();
                        else Alert.alert('Error', data.message||'Failed to delete.');
                    } catch (err) {
                        Alert.alert('Error', err.message);
                    } finally {
                        setDeleting(null);
                    }
                }},
            ]
        );
    };

    const handleLogout = () => { closeDrawer(); navigation.replace('Login'); };

    if (loading) return (
        <SafeAreaView style={s.loadingScreen}>
            <ActivityIndicator size="large" color={C.primary}/>
            <Text style={s.loadingText}>Loading Products...</Text>
        </SafeAreaView>
    );

    return (
        <SafeAreaView style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.primary}/>

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
                                        { icon: 'tachometer-alt', label: 'Dashboard', onPress: () => { closeDrawer(); navigation.navigate('AdminDashboard', { user }); } },
                                        {icon:'boxes', label:'Stocks', onPress:()=>{closeDrawer();navigation.navigate('Stocks',{user});}}, 
                                        { icon: 'boxes', label: 'Inventory', onPress: () => { closeDrawer(); navigation.navigate('Inventory', { user }); } },

                                        {icon:'arrow-circle-down', label:'Stock In', onPress:()=>{closeDrawer();navigation.navigate('StockIn',{user});}},
                                        {icon:'arrow-circle-up', label:'Stock Out', onPress:()=>{closeDrawer();navigation.navigate('StockOut',{user});}},
                                        {icon:'history', label:'Stock In History', onPress:()=>{closeDrawer();navigation.navigate('StockInHistory',{user});}},
                                    
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

            <ScrollView showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary}/>}>

                {/* Page Header */}
                <View style={s.pageHeader}>
                    <View style={s.pageTitleRow}>
                        <FontAwesome5 name="boxes" size={18} color={C.dark} style={{marginRight:10}}/>
                        <Text style={s.pageTitleText}>Stocks</Text>
                    </View>
                    <TouchableOpacity style={s.btnAdd} onPress={openAdd}>
                        <FontAwesome5 name="plus" size={13} color={C.white} style={{marginRight:6}}/>
                        <Text style={s.btnAddText}>Add Product</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary Cards - 2x2 Grid with Green Left Border & White Icons */}
                <View style={s.summaryGrid}>
                    <View style={s.summaryCard}>
                        <View style={s.summaryIcon}>
                            <FontAwesome5 name="boxes" size={18} color={C.white} />
                        </View>
                        <View style={s.summaryInfo}>
                            <Text style={s.summaryLabel}>Total Products</Text>
                            <Text style={s.summaryValue}>{totalProducts}</Text>
                        </View>
                    </View>
                    <View style={s.summaryCard}>
                        <View style={s.summaryIcon}>
                            <FontAwesome5 name="cubes" size={18} color={C.white} />
                        </View>
                        <View style={s.summaryInfo}>
                            <Text style={s.summaryLabel}>Total Stock Units</Text>
                            <Text style={s.summaryValue}>{totalUnits}</Text>
                        </View>
                    </View>
                    <View style={s.summaryCard}>
                        <View style={s.summaryIcon}>
                            <FontAwesome5 name="exclamation-triangle" size={18} color={C.white} />
                        </View>
                        <View style={s.summaryInfo}>
                            <Text style={s.summaryLabel}>Low Stock</Text>
                            <Text style={[s.summaryValue, { color: lowStock > 0 ? C.warning : C.dark }]}>{lowStock}</Text>
                        </View>
                    </View>
                    <View style={s.summaryCard}>
                        <View style={s.summaryIcon}>
                            <FontAwesome5 name="times-circle" size={18} color={C.white} />
                        </View>
                        <View style={s.summaryInfo}>
                            <Text style={s.summaryLabel}>Out of Stock</Text>
                            <Text style={[s.summaryValue, { color: outOfStock > 0 ? C.danger : C.dark }]}>{outOfStock}</Text>
                        </View>
                    </View>
                </View>

                {/* Search bar */}
                <View style={s.searchBar}>
                    <FontAwesome5 name="search" size={14} color={C.gray} style={{marginRight:8}}/>
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search products..."
                        placeholderTextColor={C.gray}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={()=>setSearch('')}>
                            <Ionicons name="close-circle" size={18} color={C.gray}/>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Products Table */}
                <View style={s.tableCard}>
                    <View style={s.tableHeader}>
                        <Text style={[s.th,{flex:2}]}>Product</Text>
                        <Text style={[s.th,{flex:1,textAlign:'center'}]}>Stock</Text>
                        <Text style={[s.th,{flex:1,textAlign:'center'}]}>Status</Text>
                        <Text style={[s.th,{flex:1,textAlign:'center'}]}>Actions</Text>
                    </View>

                    {filtered.length === 0 ? (
                        <View style={s.empty}>
                            <FontAwesome5 name="box-open" size={32} color={C.light}/>
                            <Text style={s.emptyText}>No products found.</Text>
                        </View>
                    ) : filtered.map((p,i) => {
                        const st = getStatus(p);
                        const isDeleting = deleting === p.product_id;
                        return (
                            <View key={p.product_id} style={[s.tableRow, i%2===1&&s.tableRowAlt]}>
                                <View style={{flex:2}}>
                                    <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                                    <Text style={s.productMeta}>{p.category} · ₱{parseFloat(p.price||0).toFixed(2)}</Text>
                                </View>
                                <View style={{flex:1,alignItems:'center'}}>
                                    <Text style={s.stockNum}>{p.stock}</Text>
                                    <Text style={s.stockUnit}>{p.unit||'pcs'}</Text>
                                </View>
                                <View style={{flex:1,alignItems:'center'}}>
                                    <Text style={[s.badge,st.style]}>{st.label}</Text>
                                </View>
                                <View style={{flex:1,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:6}}>
                                    <TouchableOpacity style={s.btnEdit} onPress={()=>openEdit(p)}>
                                        <FontAwesome5 name="edit" size={12} color={C.primary}/>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={s.btnDelete} onPress={()=>handleDelete(p)} disabled={isDeleting}>
                                        {isDeleting
                                            ? <ActivityIndicator size={12} color={C.danger}/>
                                            : <FontAwesome5 name="trash" size={12} color={C.danger}/>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <Text style={s.footer}>© 2026 GrocerEase – Sales & Inventory System</Text>
                <View style={{height:24}}/>
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={()=>setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
                    <TouchableWithoutFeedback onPress={()=>setModalVisible(false)}><View style={s.backdrop}/></TouchableWithoutFeedback>
                    <View style={s.modalWrap}>
                        <View style={s.modalSheet}>
                            <View style={s.modalHead}>
                                <Text style={s.modalTitle}>{isEditing?'Edit Product':'Add New Product'}</Text>
                                <TouchableOpacity onPress={()=>setModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={C.dark}/>
                                </TouchableOpacity>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false}>

                                <Text style={s.formLabel}>Product Name *</Text>
                                <TextInput style={s.formInput} placeholder="Enter product name"
                                    placeholderTextColor={C.gray} value={form.name}
                                    onChangeText={v=>setForm(f=>({...f,name:v}))}/>

                                <Text style={s.formLabel}>Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
                                    <View style={{flexDirection:'row',gap:6}}>
                                        {CATEGORIES.map(cat=>(
                                            <TouchableOpacity key={cat}
                                                style={[s.chip, form.category===cat&&s.chipActive]}
                                                onPress={()=>setForm(f=>({...f,category:cat}))}>
                                                <Text style={[s.chipText, form.category===cat&&s.chipTextActive]}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>

                                <Text style={s.formLabel}>Unit</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
                                    <View style={{flexDirection:'row',gap:6}}>
                                        {UNITS.map(u=>(
                                            <TouchableOpacity key={u}
                                                style={[s.chip, form.unit===u&&s.chipActive]}
                                                onPress={()=>setForm(f=>({...f,unit:u}))}>
                                                <Text style={[s.chipText, form.unit===u&&s.chipTextActive]}>{u}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>

                                <View style={{flexDirection:'row',gap:10}}>
                                    <View style={{flex:1}}>
                                        <Text style={s.formLabel}>Price (₱) *</Text>
                                        <TextInput style={s.formInput} placeholder="0.00"
                                            placeholderTextColor={C.gray} keyboardType="decimal-pad"
                                            value={form.price} onChangeText={v=>setForm(f=>({...f,price:v}))}/>
                                    </View>
                                    <View style={{flex:1}}>
                                        <Text style={s.formLabel}>Stock *</Text>
                                        <TextInput style={s.formInput} placeholder="0"
                                            placeholderTextColor={C.gray} keyboardType="number-pad"
                                            value={form.stock} onChangeText={v=>setForm(f=>({...f,stock:v}))}/>
                                    </View>
                                </View>

                                <Text style={s.formLabel}>Reorder Level</Text>
                                <TextInput style={s.formInput} placeholder="10"
                                    placeholderTextColor={C.gray} keyboardType="number-pad"
                                    value={form.reorder_level}
                                    onChangeText={v=>setForm(f=>({...f,reorder_level:v}))}/>

                                <View style={s.modalActions}>
                                    <TouchableOpacity style={s.btnSave} onPress={handleSave} disabled={saving}>
                                        <Text style={s.btnSaveText}>{saving?'Saving...':'Save'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={s.btnCancel} onPress={()=>setModalVisible(false)}>
                                        <Text style={s.btnCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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
    navUser:      {flexDirection:'row',alignItems:'center',gap:6},
    navUsername:  {color:C.white,fontSize:12,fontWeight:'600'},

    // Page header
    pageHeader:   {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:16,paddingBottom:12},
    pageTitleRow: {flexDirection:'row',alignItems:'center'},
    pageTitleText:{fontSize:20,fontWeight:'700',color:C.dark},
    btnAdd:       {flexDirection:'row',alignItems:'center',backgroundColor:C.primary,paddingHorizontal:14,paddingVertical:9,borderRadius:10,elevation:2},
    btnAddText:   {color:C.white,fontWeight:'700',fontSize:13},

    // Summary Cards 
    summaryGrid:  {flexDirection:'row',flexWrap:'wrap',paddingHorizontal:12,gap:12,marginBottom:20},
    summaryCard:  {
        flex: 1,
        minWidth: '45%',
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
    summaryIcon:  { width: 42, height: 42, borderRadius: 10, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    summaryInfo:  { flex: 1 },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: C.gray, textTransform: 'uppercase', letterSpacing: 0.4 },
    summaryValue: { fontSize: 18, fontWeight: '800', color: C.dark, marginTop: 4 },

    // Search
    searchBar:    {flexDirection:'row',alignItems:'center',backgroundColor:C.white,marginHorizontal:12,marginBottom:12,borderRadius:10,paddingHorizontal:14,paddingVertical:10,elevation:1},
    searchInput:  {flex:1,fontSize:14,color:C.dark},

    // Table
    tableCard:    {backgroundColor:C.white,marginHorizontal:12,borderRadius:12,overflow:'hidden',elevation:2,marginBottom:12},
    tableHeader:  {flexDirection:'row',backgroundColor:C.primary,paddingVertical:12,paddingHorizontal:12},
    th:           {fontSize:11,fontWeight:'700',color:C.white,textTransform:'uppercase',letterSpacing:0.5},
    tableRow:     {flexDirection:'row',alignItems:'center',paddingVertical:12,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:C.light},
    tableRowAlt:  {backgroundColor:'#fafafa'},
    productName:  {fontSize:13,fontWeight:'700',color:C.dark,marginBottom:2},
    productMeta:  {fontSize:11,color:C.gray},
    stockNum:     {fontSize:16,fontWeight:'800',color:C.dark},
    stockUnit:    {fontSize:10,color:C.gray},

    btnEdit:   {width:32,height:32,borderRadius:8,backgroundColor:'#e8f4f0',alignItems:'center',justifyContent:'center'},
    btnDelete: {width:32,height:32,borderRadius:8,backgroundColor:'#fde8e8',alignItems:'center',justifyContent:'center'},

    badge:   {fontSize:9,fontWeight:'700',paddingHorizontal:7,paddingVertical:3,borderRadius:20,overflow:'hidden',textAlign:'center'},
    badgeIn: {backgroundColor:'#d4edda',color:'#155724'},
    badgeLow:{backgroundColor:'#fff3cd',color:'#856404'},
    badgeOut:{backgroundColor:'#f8d7da',color:'#721c24'},

    empty:    {paddingVertical:40,alignItems:'center',gap:10},
    emptyText:{color:C.gray,fontSize:14},
    footer:   {textAlign:'center',fontSize:11,color:C.gray,paddingVertical:8,marginTop:4},

    // Modal
    modalWrap:  {flex:1,justifyContent:'flex-end'},
    modalSheet: {backgroundColor:C.white,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,maxHeight:'90%',elevation:10},
    modalHead:  {flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
    modalTitle: {fontSize:18,fontWeight:'700',color:C.dark},

    formLabel:  {fontSize:12,fontWeight:'600',color:C.dark,marginBottom:6,textTransform:'uppercase',letterSpacing:0.3},
    formInput:  {borderWidth:1,borderColor:C.light,borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:C.dark,backgroundColor:C.bg,marginBottom:14},

    chip:     {paddingHorizontal:12,paddingVertical:7,borderRadius:20,backgroundColor:C.bg,borderWidth:1,borderColor:C.light},
    chipActive:{backgroundColor:C.primary,borderColor:C.primary},
    chipText: {fontSize:12,color:C.gray,fontWeight:'500'},
    chipTextActive:{color:C.white,fontWeight:'700'},

    modalActions:{flexDirection:'row',gap:10,marginTop:8,marginBottom:16},
    btnSave:   {flex:1,backgroundColor:C.primary,borderRadius:10,paddingVertical:13,alignItems:'center'},
    btnSaveText:{color:C.white,fontWeight:'700',fontSize:14},
    btnCancel: {flex:1,backgroundColor:C.bg,borderRadius:10,paddingVertical:13,alignItems:'center',borderWidth:1,borderColor:C.light},
    btnCancelText:{color:C.dark,fontWeight:'600',fontSize:14},
});