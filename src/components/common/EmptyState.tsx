import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';

export interface EmptyStateProps {
  iconName?: string;
  badgeIcon?: string;
  title: string;
  description?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  suggestions?: { label: string; onPress: () => void }[];
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName = 'basket-outline',
  badgeIcon = 'sparkles',
  title,
  description,
  message,

  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  suggestions,
}) => {
  const { colors, borderRadius } = useTheme();

  return (
    <View style={styles.container}>
      {/* Layered Decorative Emblem */}
      <View style={styles.iconWrapper}>
        <View
          style={[
            styles.outerHalo,
            {
              backgroundColor: colors.surfaceVariant,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.innerCircle,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name={iconName} size={48} color={colors.primary} />
          </View>
        </View>

        {/* Small floating badge */}
        {badgeIcon && (
          <View
            style={[
              styles.floatingBadge,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.surface,
              },
            ]}
          >
            <Ionicons name={badgeIcon} size={14} color={colors.onSecondary} />
          </View>
        )}
      </View>

      {/* Title & Description */}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description || message}
      </Text>


      {/* Suggested Quick Links if available */}
      {suggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsLabel, { color: colors.textTertiary }]}>
            Popular Searches:
          </Text>
          <View style={styles.chipsRow}>
            {suggestions.map((sug, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={sug.onPress}
                activeOpacity={0.75}
                style={[
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.primary }]}>
                  {sug.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {actionLabel && onAction && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onAction}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
              {actionLabel}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color={colors.onPrimary}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onSecondaryAction}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.border,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
              {secondaryActionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 22,
  },
  outerHalo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  innerCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  floatingBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: 20,
  },
  suggestionsContainer: {
    alignItems: 'center',
    marginBottom: 22,
  },
  suggestionsLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 260,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
