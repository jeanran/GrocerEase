import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert, FlatList, RefreshControl,
    StatusBar, Modal, ScrollView, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'staff',
    });

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
        // Only admin can access this screen
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
                setRefreshing(true);
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

    const filteredUsers = users.filter((u) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleColor = (role) => {
        return role === 'admin' ? COLORS.danger : COLORS.primary;
    };

    const renderUserItem = ({ item }) => (
        <View style={styles.userCard}>
            <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                    <View style={[styles.userAvatar, { backgroundColor: getRoleColor(item.role) + '30' }]}>
                        <FontAwesome5
                            name={item.role === 'admin' ? 'crown' : 'user'}
                            size={16}
                            color={getRoleColor(item.role)}
                        />
                    </View>
                    <View>
                        <Text style={styles.userName}>{item.username}</Text>
                        <Text style={styles.userEmail}>{item.email}</Text>
                    </View>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
                    <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                        {item.role.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={styles.userMeta}>
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Status</Text>
                    <View style={[styles.statusBadge, item.is_verified && { backgroundColor: COLORS.success + '20' }]}>
                        <FontAwesome5
                            name={item.is_verified ? 'check-circle' : 'times-circle'}
                            size={12}
                            color={item.is_verified ? COLORS.success : COLORS.warning}
                        />
                        <Text
                            style={[
                                styles.statusText,
                                { color: item.is_verified ? COLORS.success : COLORS.warning },
                            ]}
                        >
                            {item.is_verified ? 'Verified' : 'Unverified'}
                        </Text>
                    </View>
                </View>
                <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Joined</Text>
                    <Text style={styles.metaValue}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
            </View>

            <View style={styles.userActions}>
                <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openForm(item)}
                    disabled={String(item.user_id) === String(user?.user_id)}
                >
                    <FontAwesome5 name="edit" size={14} color={COLORS.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
            </View>
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
                <Text style={styles.headerTitle}>Users</Text>
                <View style={{ width: 26 }} />
            </View>

            <View style={styles.searchBar}>
                <FontAwesome5 name="search" size={14} color={COLORS.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search users..."
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

            <View style={styles.actionBar}>
                <TouchableOpacity style={styles.addButton} onPress={() => openForm()}>
                    <FontAwesome5 name="plus" size={16} color={COLORS.white} />
                    <Text style={styles.addButtonText}>Add User</Text>
                </TouchableOpacity>
            </View>

            {filteredUsers.length === 0 ? (
                <View style={styles.emptyState}>
                    <FontAwesome5 name="inbox" size={48} color={COLORS.border} />
                    <Text style={styles.emptyStateText}>No users found</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(item) => item.user_id}
                    renderItem={renderUserItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Edit/Add User Modal */}
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
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.formContent}>
                            <Text style={styles.label}>Username {!editingUser && '*'}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter username"
                                value={formData.username}
                                onChangeText={(text) => setFormData({ ...formData, username: text })}
                                editable={!editingUser}
                            />

                            <Text style={styles.label}>Email *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email"
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
                                        <Text
                                            style={[
                                                styles.roleOptionText,
                                                formData.role === role && styles.roleOptionTextActive,
                                            ]}
                                        >
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
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
                                    <ActivityIndicator size="small" color={COLORS.white} />
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
    actionBar: {
        paddingHorizontal: 16,
        paddingBottom: 12,
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    userCard: {
        backgroundColor: COLORS.white,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    userHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    userEmail: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    roleText: {
        fontSize: 11,
        fontWeight: '700',
    },
    userMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 8,
    },
    metaItem: {
        flex: 1,
    },
    metaLabel: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '600',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: COLORS.warning + '20',
        borderRadius: 4,
        width: 'fit-content',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    metaValue: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
        marginTop: 4,
    },
    userActions: {
        flexDirection: 'row',
        gap: 8,
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: COLORS.primary,
        borderRadius: 6,
        gap: 6,
    },
    editBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
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
        justifyContent: 'center',
        alignItems: 'center',
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
    roleSelector: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    roleOption: {
        flex: 1,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    roleOptionActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    roleOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
    },
    roleOptionTextActive: {
        color: COLORS.white,
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
