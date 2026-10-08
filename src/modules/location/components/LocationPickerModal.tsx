import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_SETTINGS } from '../../../app/config';
import { RootStackParamList } from '../../../navigation/types';
import { useAuth } from '../../auth';
import { useAddress } from '../../profile/context/AddressContext';
import { SavedAddress } from '../../profile/types/address';
import { useTheme } from '../../../theme';
import { useLocation } from '../hooks/useLocation';

export const LocationPickerModal: React.FC = () => {
  const { colors, borderRadius, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const {
    isPickerVisible,
    closeLocationPicker,
    setManualLocation,
  } = useLocation();
  const { addresses, selectedAddress, selectAddress } = useAddress();

  const handleAddNewAddress = () => {
    closeLocationPicker();
    navigation.navigate('AddressForm');
  };

  const handleEditAddress = (address: SavedAddress) => {
    closeLocationPicker();
    navigation.navigate('AddressForm', { addressToEdit: address });
  };

  const handleSelectSavedAddress = (item: SavedAddress) => {
    selectAddress(item.id);
    const shortAddr = `${item.flatNo ? item.flatNo + ', ' : ''}${item.streetArea}`;
    const fullAddr = `${item.flatNo ? item.flatNo + ', ' : ''}${item.streetArea}, ${item.city}, ${item.state} - ${item.pincode}`;
    setManualLocation(shortAddr, fullAddr);
    closeLocationPicker();
  };

  const isMaxLimitReached = addresses && addresses.length >= 5;

  return (
    <Modal
      visible={isPickerVisible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={closeLocationPicker}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closeLocationPicker}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleCol}>
              <View style={styles.titleWithIconRow}>
                <View style={[styles.titleIconBadge, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  Delivery Location
                </Text>
              </View>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                Select your delivery address
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!isMaxLimitReached && (
                <TouchableOpacity
                  onPress={handleAddNewAddress}
                  style={[styles.headerAddBtn, { backgroundColor: `${colors.primary}15` }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={14} color={colors.primary} style={{ marginRight: 2 }} />
                  <Text style={[styles.headerAddBtnText, { color: colors.primary }]}>NEW</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={closeLocationPicker}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant, marginLeft: 8 }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Section Divider */}
          <View style={styles.sectionDividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>
              SAVED ADDRESSES ({addresses?.length || 0}/5)
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Saved Addresses List */}
          {addresses && addresses.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={true}
              style={styles.locationsList}
              contentContainerStyle={styles.locationsListContent}
            >
              {addresses.map((item, index) => {
                const isSelected = Boolean(selectedAddress?.id && String(selectedAddress.id) === String(item.id));
                const iconName =
                  item.type === 'WORK'
                    ? 'briefcase-outline'
                    : item.type === 'HOME'
                    ? 'home-outline'
                    : 'location-outline';

                return (
                  <TouchableOpacity
                    key={item.id || `addr_${index}`}
                    activeOpacity={0.75}
                    onPress={() => handleSelectSavedAddress(item)}
                    style={[
                      styles.addressCard,
                      {
                        backgroundColor: isSelected ? `${colors.primary}0D` : colors.surfaceVariant,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    {/* Top Row: Type Badge, Name, Edit, and Radio */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.typeBadgeRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.surface,
                            },
                          ]}
                        >
                          <Ionicons
                            name={iconName}
                            size={12}
                            color={isSelected ? '#FFFFFF' : colors.primary}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[
                              styles.typeBadgeText,
                              { color: isSelected ? '#FFFFFF' : colors.primary },
                            ]}
                          >
                            {item.type}
                          </Text>
                        </View>

                        {item.isDefault && (
                          <View style={[styles.defaultBadge, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.defaultBadgeText, { color: colors.onSecondary }]}>
                              DEFAULT
                            </Text>
                          </View>
                        )}

                        {item.isVerified && (
                          <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={11} color="#10B981" style={{ marginRight: 2 }} />
                            <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                          </View>
                        )}

                        <Text style={[styles.recipientNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>

                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => handleEditAddress(item)}
                          style={[
                            styles.editBtn,
                            {
                              backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          <Ionicons name="pencil-outline" size={11} color={colors.primary} style={{ marginRight: 2 }} />
                          <Text style={[styles.editBtnText, { color: colors.primary }]}>EDIT</Text>
                        </TouchableOpacity>

                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? colors.primary : colors.textTertiary}
                        />
                      </View>
                    </View>

                    {/* Formatted Address */}
                    <Text style={[styles.addressLineText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.flatNo ? `${item.flatNo}, ` : ''}
                      {item.landmark ? `${item.landmark}, ` : ''}
                      {item.streetArea}, {item.city} - {item.pincode}
                    </Text>

                    {item.phone ? (
                      <Text style={[styles.phoneText, { color: colors.textTertiary }]}>
                        📞 {item.phone}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyAddressBox}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}14` }]}>
                <Ionicons name="location-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No Saved Addresses Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Add your delivery address to proceed with instant checkout and accurate 15-minute delivery.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '82%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  headerTitleCol: {
    flex: 1,
  },
  titleWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  addNewAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.2,
    marginBottom: 12,
  },
  addIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addBtnTextCol: {
    flex: 1,
  },
  addBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  addBtnSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  sectionDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 10,
  },
  locationsList: {
    maxHeight: 290,
  },
  locationsListContent: {
    paddingVertical: 4,
  },
  addressCard: {
    padding: 13,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  headerAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 0.5,
    borderColor: '#10B981',
  },
  verifiedBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.3,
  },
  recipientNameText: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  addressLineText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 3,
  },
  phoneText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyAddressBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});

export default LocationPickerModal;
