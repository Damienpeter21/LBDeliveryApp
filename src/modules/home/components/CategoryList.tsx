import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../../theme';
import { Category } from '../../products/types/product';
import { formatOdooImage } from '../services/HomeActions';

interface CategoryListProps {
  categories: Category[];
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string, categoryName: string) => void;
  onViewAllCategories?: () => void;
}

export const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  selectedCategoryId = '',
  onSelectCategory,
  onViewAllCategories,
}) => {
  const { colors, spacing, borderRadius, isDark } = useTheme();

  const displayCategories = React.useMemo(() => {
    return (categories ?? [])
      .filter(c => {
        const name = (c?.name || '').trim().toLowerCase();
        const id = String(c?.id || '').trim().toLowerCase();
        return id !== 'all' && name !== 'all' && name !== 'all category' && name !== 'all categories';
      })
      .map(category => {
        const imageUri = formatOdooImage(category.image_1920 || (category as any).imageUrl);
        return {
          id: String(category.id),
          name: category.name,
          imageUrl: imageUri,
          initials: (category.name || 'C').slice(0, 2).toUpperCase(),
        };
      });
  }, [categories]);

  if (displayCategories.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      {/* Section Header */}
      <View style={[styles.headerRow, { paddingHorizontal: 16 }]}>
        <View style={styles.headingLeft}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
            Categories
          </Text>
          <View style={[styles.countPill, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.countPillText, { color: colors.primary }]}>
              {displayCategories.length}
            </Text>
          </View>
        </View>

        {onViewAllCategories && (
          <TouchableOpacity
            onPress={onViewAllCategories}
            style={[styles.viewAllBtn, { backgroundColor: colors.surfaceVariant }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllText, { color: colors.primary }]}>See All</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Premium Squircle Category Tiles Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.container, { paddingHorizontal: 16 }]}
      >
        {displayCategories.map(category => {
          const isSelected = !!selectedCategoryId && String(selectedCategoryId) === String(category.id);

          return (
            <TouchableOpacity
              key={category.id}
              onPress={() => onSelectCategory(category.id, category.name)}
              activeOpacity={0.75}
              style={styles.categoryItem}
            >
              {/* Premium Squircle Image Tile */}
              <View
                style={[
                  styles.imagePod,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? `${colors.primary}25`
                        : `${colors.primary}12`
                      : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    shadowColor: isSelected ? colors.primary : '#000',
                    shadowOpacity: isSelected ? 0.22 : 0.05,
                  },
                ]}
              >
                {category.imageUrl ? (
                  <Image
                    source={{ uri: category.imageUrl }}
                    style={styles.categoryImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.initialsPod,
                      {
                        backgroundColor: isDark
                          ? `${colors.primary}20`
                          : `${colors.primary}10`,
                      },
                    ]}
                  >
                    <Text style={[styles.initialsText, { color: colors.primary }]}>
                      {category.initials}
                    </Text>
                  </View>
                )}
              </View>

              {/* Category Name Label */}
              <Text
                style={[
                  styles.categoryNameText,
                  {
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontWeight: isSelected ? '800' : '600',
                  },
                ]}
                numberOfLines={2}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 8,
    marginLeft: 8,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 12,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    marginRight: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: 12,
  },
  categoryItem: {
    alignItems: 'center',
    width: 74,
  },
  imagePod: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2.5,
    padding: 6,
    marginBottom: 6,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  initialsPod: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  categoryNameText: {
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 14.5,
    marginTop: 1,
  },
});

export default CategoryList;
