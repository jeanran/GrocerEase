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
    ScrollView,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    warning:      '#beb09a',
    success:      '#233b2d',
    bg:           '#f0f2f5',
    border:       '#e9ecef',
    text:         '#2c3e50',
    textMuted:    '#95a5a6',
    sidebar:      '#1e2d3d',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.72, 280);
const ROLES = ['admin', 'staff'];

export default function UsersManagementScreen({ navigation, route }) {
    const { user } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'staff',
    });

    const drawerX = useRef(new Animated.Value(-DRAWER_W)).current;

    const openDrawer = () => {
        setDrawerOpen(true);
        Animated.timing(drawerX, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const loadUsers = useCallback(async () => {
        try {
            const data = await fetchJson(`${API_URL}/api/mobile/users/`);
            if (data.success) {
                setUsers(data.users || []);
            } else {
                Alert.alert('Error', data.message || 'Failed to load users.');
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to load users: ' + err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role !== 'admin') {
            Alert.alert('Unauthorized', 'Only admins can manage users.');
            navigation.goBack();
            return;
        }
        loadUsers();
    }, [loadUsers, user, navigation]);

    const onRefresh = () => {
        setRefreshing(true);
        loadUsers();
    };

    const openForm = (userToEdit = null) => {
        if (userToEdit) {
            setEditingUser(userToEdit);
            setFormData({
                username: userToEdit.username,
                email: userToEdit.email,
                password: '',
                role: userToEdit.role,
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                email: '',
                password: '',
                role: 'staff',
            });
        }
        setModalVisible(true);
    };

    const closeForm = () => {
        setModalVisible(false);
        setEditingUser(null);
        setProcessing(false);
    };

    const handleSaveUser = async () => {
        if (!formData.username || !formData.email) {
            Alert.alert('Validation', 'Username and email are required.');
            return;
        }

        if (!editingUser && !formData.password) {
            Alert.alert('Validation', 'Password is required for new users.');
            return;
        }

        setProcessing(true);
        try {
            const endpoint = editingUser
                ? `${API_URL}/api/mobile/users/${editingUser.user_id}/edit/`
                : `${API_URL}/api/mobile/users/add/`;

            const body = editingUser
                ? { role: formData.role, ...(formData.password && { password: formData.password }) }
                : formData;

            const data = await fetchJson(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
            });

            if (data.success) {
                Alert.alert('Success', data.message || 'User saved successfully.');
                closeForm();
                loadUsers();
            } else {
                Alert.alert('Error', data.message || 'Failed to save user.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleLogout = () => {
        closeDrawer();
        navigation.replace('Login');
    };

    const filteredUsers = users.filter((u) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadge = (role) => {
        if (role === 'admin') {
            return { bg: '#fdecea', color: C.danger, icon: 'crown' };
        }
        return { bg: '#d4edda', color: C.success, icon: 'user' };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const d = new Date(dateString);
        return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`;
    };

    const renderUserCard = ({ item, index }) => {
        const roleStyle = getRoleBadge(item.role);
        return (
            <View style={styles.userCard}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.userInfo}>
                        <View style={[styles.userAvatar, { backgroundColor: roleStyle.bg }]}>
                            <FontAwesome5 name={roleStyle.icon} size={18} color={roleStyle.color} />
                        </View>
                        <View>
                            <Text style={styles.userName}>{item.username}</Text>
                            <Text style={styles.userEmail}>{item.email}</Text>
                        </View>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
                        <Text style={[styles.roleText, { color: roleStyle.color }]}>
                            {item.role === 'admin' ? 'Admin' : 'Staff'}
                        </Text>
                    </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <FontAwesome5 name="calendar-alt" size={12} color={C.gray} />
                            <Text style={styles.infoLabel}>Joined</Text>
                            <Text style={styles.infoValue}>{formatDate(item.created_at)}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <View style={[styles.verifiedBadge, item.is_verified && styles.verifiedTrue]}>
                                <FontAwesome5 
                                    name={item.is_verified ? 'check-circle' : 'clock'} 
                                    size={10} 
                                    color={item.is_verified ? C.success : C.warning} 
                                />
                                <Text style={[styles.verifiedText, { color: item.is_verified ? C.success : C.warning }]}>
                                    {item.is_verified ? 'Verified' : 'Pending'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Card Footer - Edit Button */}
                <View style={styles.cardFooter}>
                    <TouchableOpacity 
                        style={styles.editBtn}
                        onPress={() => openForm(item)}
                        disabled={String(item.user_id) === String(user?.user_id)}
                    >
                        <FontAwesome5 name="edit" size={12} color={C.primary} />
                        <Text style={styles.editBtnText}>Edit User</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

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
                            { icon: 'history', label: 'Stock In History', onPress: () => { closeDrawer(); navigation.navigate('StockInHistory', { user }); } },
                            { icon: 'users', label: 'Manage Users', onPress: closeDrawer },
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
            <View style={styles.container}>
                {/* Page Header */}
                <View style={styles.pageHeader}>
                    <View style={styles.pageTitle}>
                        <FontAwesome5 name="users" size={18} color={C.dark} style={{ marginRight: 10 }} />
                        <Text style={styles.pageTitleText}>Manage Users</Text>
                    </View>
                    <TouchableOpacity style={styles.addButton} onPress={() => openForm()}>
                        <FontAwesome5 name="plus" size={13} color={C.white} style={{ marginRight: 7 }} />
                        <Text style={styles.addButtonText}>Add User</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <FontAwesome5 name="search" size={14} color={C.gray} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by username, email or role..."
                        placeholderTextColor={C.gray}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="close" size={18} color={C.gray} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Users Cards List */}
                {filteredUsers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome5 name="inbox" size={48} color={C.light} />
                        <Text style={styles.emptyStateText}>No users found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredUsers}
                        keyExtractor={(item) => item.user_id}
                        renderItem={renderUserCard}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl 
                                refreshing={refreshing} 
                                onRefresh={onRefresh}
                                colors={[C.primary]}
                                tintColor={C.primary}
                            />
                        }
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* ADD/EDIT USER MODAL */}
            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeForm}>
                <TouchableWithoutFeedback onPress={closeForm}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <View style={styles.modalContainer}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingUser ? 'Edit User' : 'Add New User'}
                            </Text>
                            <TouchableOpacity onPress={closeForm}>
                                <Ionicons name="close" size={24} color={C.dark} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                            <Text style={styles.label}>Username {!editingUser && '*'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter username"
                                placeholderTextColor={C.gray}
                                value={formData.username}
                                onChangeText={(text) => setFormData({ ...formData, username: text })}
                                editable={!editingUser}
                            />

                            <Text style={styles.label}>Email *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email"
                                placeholderTextColor={C.gray}
                                keyboardType="email-address"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                                editable={!editingUser}
                            />

                            <Text style={styles.label}>
                                Password {!editingUser && '*'} {editingUser && '(leave blank to keep)'}
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter password"
                                placeholderTextColor={C.gray}
                                secureTextEntry
                                value={formData.password}
                                onChangeText={(text) => setFormData({ ...formData, password: text })}
                            />

                            <Text style={styles.label}>Role</Text>
                            <View style={styles.roleSelector}>
                                {ROLES.map((role) => (
                                    <TouchableOpacity
                                        key={role}
                                        style={[
                                            styles.roleOption,
                                            formData.role === role && styles.roleOptionActive,
                                        ]}
                                        onPress={() => setFormData({ ...formData, role })}
                                    >
                                        <FontAwesome5 
                                            name={role === 'admin' ? 'crown' : 'user'} 
                                            size={12} 
                                            color={formData.role === role ? C.white : C.gray} 
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text
                                            style={[
                                                styles.roleOptionText,
                                                formData.role === role && styles.roleOptionTextActive,
                                            ]}
                                        >
                                            {role === 'admin' ? 'Admin' : 'Staff'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.submitBtn, processing && { opacity: 0.6 }]}
                                onPress={handleSaveUser}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator size="small" color={C.white} />
                                ) : (
                                    <Text style={styles.submitBtnText}>Save User</Text>
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
    pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    pageTitle: { flexDirection: 'row', alignItems: 'center' },
    pageTitleText: { fontSize: 20, fontWeight: '600', color: C.dark },
    addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
    addButtonText: { color: C.white, fontWeight: '700', fontSize: 13 },

    // Search Bar
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
    searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

    // List Content
    listContent: { paddingBottom: 20 },

    // User Card
    userCard: {
        backgroundColor: C.white,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: C.text,
    },
    userEmail: {
        fontSize: 12,
        color: C.gray,
        marginTop: 2,
    },
    roleBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    cardBody: {
        padding: 16,
        backgroundColor: '#fafafa',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoLabel: {
        fontSize: 12,
        color: C.gray,
        marginLeft: 4,
    },
    infoValue: {
        fontSize: 12,
        fontWeight: '600',
        color: C.text,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
    },
    verifiedTrue: {
        backgroundColor: '#d4edda',
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '600',
    },
    cardFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: C.primary,
        borderRadius: 8,
        backgroundColor: C.white,
    },
    editBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: C.primary,
    },

    // Empty State
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyStateText: { marginTop: 12, fontSize: 14, color: C.gray },

    // Modal
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
    modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
    modalTitle: { fontSize: 17, fontWeight: '700', color: C.dark },
    modalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.dark, backgroundColor: C.white, marginBottom: 16 },
    roleSelector: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10, gap: 6 },
    roleOptionActive: { backgroundColor: C.primary, borderColor: C.primary },
    roleOptionText: { fontSize: 13, fontWeight: '600', color: C.gray },
    roleOptionTextActive: { color: C.white },
    modalActions: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: C.border },
    cancelBtn: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.text },
    submitBtn: { flex: 1, paddingVertical: 12, backgroundColor: C.primary, borderRadius: 10, alignItems: 'center' },
    submitBtnText: { fontSize: 14, fontWeight: '600', color: C.white },
});