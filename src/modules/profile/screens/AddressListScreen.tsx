import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, EmptyState, Skeleton, useStatusModal } from '../../../components';
import { useLocation } from '../../location';
import { useTheme } from '../../../theme';
import { useAddress } from '../context/AddressContext';
import { SavedAddress } from '../types/address';

interface AddressListScreenProps {
  onBack: () => void;
  onNavigateToAddAddress: () => void;
  onNavigateToEditAddress: (address: SavedAddress) => void;
  onSelectAndReturn?: (address: SavedAddress) => void;
}

export const AddressListScreen: React.FC<AddressListScreenProps> = ({
  onBack,
  onNavigateToAddAddress,
  onNavigateToEditAddress,
  onSelectAndReturn,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, spacing, borderRadius } = useTheme();
  const {
    addresses,
    selectedAddress,
    loading,
    deleteAddress,
    setDefaultAddress,
    selectAddress,
    refreshAddresses,
  } = useAddress();
  const { setManualLocation } = useLocation();
  const { showStatusModal } = useStatusModal();

  const handleSelectAddress = (address: SavedAddress) => {
    selectAddress(address.id);
    const shortAddr = `${address.flatNo}, ${address.streetArea}`;
    const fullAddr = `${address.flatNo}, ${address.streetArea}, ${address.city}, ${address.state} - ${address.pincode}`;
    setManualLocation(shortAddr, fullAddr);

    if (onSelectAndReturn) {
      onSelectAndReturn(address);
    }
  };

  const handleDeletePrompt = (address: SavedAddress) => {
    showStatusModal({
      type: 'confirm',
      title: 'Remove Address',
      message: `Are you sure you want to delete the address for "${address.name}"?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDestructive: true,
      onConfirm: () => deleteAddress(address.id),
    });
  };

  const renderAddressCard = ({ item }: { item: SavedAddress }) => {
    const isSelected = selectedAddress?.id === item.id;

    return (
      <View
        style={[
          styles.addressCard,
          {
            backgroundColor: colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 1.5 : 1,
            borderRadius: borderRadius.xl,
          },
        ]}
      >
        {/* Header Row: Name, Phone & Type Pill */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.namePhoneRow}>
            <Text style={[styles.receiverName, { color: colors.textPrimary }]}>
              {item.name}
            </Text>
            <Text style={[styles.receiverPhone, { color: colors.textSecondary }]}>
              {item.phone}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.typePill,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name={item.type === 'WORK' ? 'briefcase' : 'home'}
                size={11}
                color={colors.primary}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.typePillText, { color: colors.primary }]}>
                {item.type}
              </Text>
            </View>

            {item.isDefault && (
              <View style={[styles.defaultPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.defaultPillText, { color: colors.onSecondary }]}>
                  DEFAULT
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Address Body */}
        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
          {item.flatNo}, {item.streetArea}
          {item.landmark ? `, Landmark: ${item.landmark}` : ''}
          {`\n${item.city}, ${item.state} - ${item.pincode}`}
        </Text>

        {/* Flipkart-Style Action Bar */}
        <View style={[styles.cardFooterRow, { borderTopColor: colors.divider }]}>
          {/* Deliver Here Selection Action */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSelectAddress(item)}
            style={[
              styles.deliverHereBtn,
              {
                backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
              size={15}
              color={isSelected ? colors.onPrimary : colors.textSecondary}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.deliverHereText,
                { color: isSelected ? colors.onPrimary : colors.textPrimary },
              ]}
            >
              {isSelected ? 'SELECTED FOR DELIVERY' : 'DELIVER HERE'}
            </Text>
          </TouchableOpacity>

          {/* Edit & Delete Action Buttons */}
          <View style={styles.actionButtonsBox}>
            <TouchableOpacity
              onPress={() => onNavigateToEditAddress(item)}
              activeOpacity={0.7}
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
            >
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDeletePrompt(item)}
              activeOpacity={0.7}
              style={[
                styles.iconActionBtn,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const isMaxLimitReached = addresses.length >= 5;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="My Addresses" onBack={onBack} />

      {/* Top "+ Add a new address" Banner (Flipkart Standard) */}
      <View style={[styles.topAddContainer, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isMaxLimitReached}
          onPress={onNavigateToAddAddress}
          style={[
            styles.addNewAddressBar,
            {
              backgroundColor: isMaxLimitReached ? colors.surfaceVariant : `${colors.primary}10`,
              borderColor: isMaxLimitReached ? colors.border : colors.primary,
              borderRadius: borderRadius.lg,
              opacity: isMaxLimitReached ? 0.65 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.plusCircle,
              { backgroundColor: isMaxLimitReached ? colors.textTertiary : colors.primary },
            ]}
          >
            <Ionicons
              name={isMaxLimitReached ? 'lock-closed' : 'add'}
              size={16}
              color={colors.onPrimary}
            />
          </View>
          <Text
            style={[
              styles.addNewAddressText,
              {
                color: isMaxLimitReached ? colors.textSecondary : colors.primary,
                flex: 1,
              },
            ]}
          >
            {isMaxLimitReached
              ? 'Address limit reached (Maximum 5 saved)'
              : '+ Add a new delivery address'}
          </Text>
          {!isMaxLimitReached && <Ionicons name="chevron-forward" size={16} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* Loading Skeleton / Addresses List / Empty State */}
      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.addressCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: borderRadius.xl,
                  padding: 16,
                  marginBottom: 14,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Skeleton width={120} height={18} borderRadius={6} />
                <Skeleton width={60} height={18} borderRadius={10} />
              </View>
              <Skeleton width="85%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
              <Skeleton width="60%" height={14} borderRadius={4} style={{ marginBottom: 14 }} />
              <Skeleton width="100%" height={38} borderRadius={8} />
            </View>
          ))}
        </View>
      ) : addresses.length === 0 ? (
        <EmptyState
          iconName="location-outline"
          badgeIcon="add"
          title="No Saved Addresses"
          description="You haven't added any delivery addresses yet. Add your home or work address for quick 1-tap checkout."
          actionLabel="+ Add New Address"
          onAction={onNavigateToAddAddress}
        />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item.id}
          onRefresh={refreshAddresses}
          refreshing={loading}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 30, 40) },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={renderAddressCard}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topAddContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  addNewAddressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  plusCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addNewAddressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  addressCard: {
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  namePhoneRow: {
    flexDirection: 'column',
  },
  receiverName: {
    fontSize: 15,
    fontWeight: '800',
  },
  receiverPhone: {
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  defaultPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  defaultPillText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  addressText: {
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 8,
    fontWeight: '500',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 4,
  },
  deliverHereBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deliverHereText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionButtonsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
