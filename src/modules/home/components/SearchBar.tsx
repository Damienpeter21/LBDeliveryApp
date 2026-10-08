import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  loading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = 'Search for products, brands and more...',
  onSubmitEditing,
  loading = false,
}) => {
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: value.trim().length > 0 ? colors.primary : colors.border,
          borderRadius: borderRadius.lg + 2,
          marginHorizontal: spacing.md,
          marginVertical: spacing.xs + 2,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: value.trim().length > 0 ? 0.08 : 0.03,
          shadowRadius: 6,
          elevation: 3,
        },
      ]}
    >
      <View style={styles.contentRow}>
        <View
          style={[
            styles.searchIconBox,
            { backgroundColor: value.trim().length > 0 ? `${colors.primary}18` : colors.surfaceVariant },
          ]}
        >
          <Ionicons
            name="search"
            size={16}
            color={value.trim().length > 0 ? colors.primary : colors.textSecondary}
          />
        </View>

        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
        />

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {value.length > 0 && !loading && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 50,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
    marginRight: 2,
  },
  loadingBox: {
    padding: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
