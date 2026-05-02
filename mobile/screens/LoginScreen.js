import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, ScrollView,
    KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import API_URL from '../config';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');

    const handleLogin = async () => {
        setError('');
        if (!username.trim() || !password) {
            setError('Please enter username and password.');
            return;
        }
        setLoading(true);
        try {
            const res  = await fetch(`${API_URL}/api/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            });
            const data = await res.json();
            if (data.success) {
                if (data.role === 'admin') {
                    navigation.replace('Dashboard', { user: data });
                } else {
                    navigation.replace('POSScreen', { user: data });
                }
            } else {
                setError(data.message || 'Invalid credentials.');
            }
        } catch (err) {
            setError(`Cannot reach server. Make sure Django is running and IP is correct.\n${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex}
        >
            <StatusBar barStyle="light-content" backgroundColor="#0e5545" />

            {/* Gradient background */}
            <View style={styles.bgTop} />
            <View style={styles.bgBottom} />

            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>

                    {/* Logo — fas fa-store */}
                    <View style={styles.logoCircle}>
                        <FontAwesome5 name="store" size={36} color="#fff" />
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>
                        Grocer<Text style={styles.titleAccent}>Ease</Text>
                    </Text>
                    <Text style={styles.subtitle}>Sales & Inventory System</Text>

                    {/* Error box */}
                    {error ? (
                        <View style={styles.errorBox}>
                            <FontAwesome5 name="exclamation-circle" size={13} color="#721c24" />
                            <Text style={styles.errorText}> {error}</Text>
                        </View>
                    ) : null}

                    {/* Username — fas fa-user */}
                    <View style={styles.inputGroup}>
                        <FontAwesome5 name="user" size={15} color="#95a5a6" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#95a5a6"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    {/* Password — fas fa-lock */}
                    <View style={styles.inputGroup}>
                        <FontAwesome5 name="lock" size={15} color="#95a5a6" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#95a5a6"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {/* Login button */}
                    <TouchableOpacity
                        style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.loginBtnText}>Login</Text>
                        }
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },

    bgTop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1e6f5c',
    },
    bgBottom: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0e5545',
        top: '50%',
    },

    container: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },

    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },

    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#289672',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        elevation: 4,
    },

    title:       { fontSize: 28, fontWeight: '700', color: '#2c3e50', marginBottom: 4 },
    titleAccent: { color: '#1e6f5c' },
    subtitle:    { fontSize: 14, color: '#95a5a6', marginBottom: 24 },

    errorBox: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8d7da',
        borderRadius: 8,
        padding: 10,
        marginBottom: 16,
    },
    errorText: { color: '#721c24', fontSize: 13, flex: 1 },

    inputGroup: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 30,
        paddingHorizontal: 16,
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    icon:  { marginRight: 10 },
    input: { flex: 1, paddingVertical: 13, fontSize: 15, color: '#2c3e50' },

    loginBtn:         { width: '100%', backgroundColor: '#1e6f5c', borderRadius: 30, padding: 14, alignItems: 'center', marginTop: 4 },
    loginBtnDisabled: { opacity: 0.7 },
    loginBtnText:     { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
});