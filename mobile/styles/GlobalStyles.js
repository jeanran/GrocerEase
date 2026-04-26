import { StyleSheet } from 'react-native';

export const colors = {
    primary:    '#1e6f5c',
    primaryDark:'#0e5545',
    secondary:  '#40916c',
    accent:     '#74c69d',
    background: '#fdf8f0',
    white:      '#ffffff',
    dark:       '#1a2e22',
    muted:      '#6b7c6e',
    border:     '#d8e8de',
    error:      '#e74c3c',
    warning:    '#f39c12',
    success:    '#27ae60',
};

export const globalStyles = StyleSheet.create({
    // Layout
    flex:       { flex: 1, backgroundColor: colors.background },
    center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:  { flex: 1, padding: 16, backgroundColor: colors.background },

    // Card
    card: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: colors.primary,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },

    // Button
    btn: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
    },
    btnText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '700',
    },
    btnDisabled: { opacity: 0.7 },

    // Input
    input: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 13,
        fontSize: 15,
        color: colors.dark,
        backgroundColor: colors.background,
        marginBottom: 16,
    },

    // Text
    heading:  { fontSize: 22, fontWeight: '700', color: colors.dark },
    subtext:  { fontSize: 14, color: colors.muted },
    label:    { fontSize: 13, fontWeight: '600', color: colors.dark, marginBottom: 7 },

    // Logo
    logoWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    logoIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 10,
    },
    logoText:   { fontSize: 24, fontWeight: '700', color: colors.dark },
    logoAccent: { color: colors.secondary },
});