import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, ChatPeopleList, EmptyState, Screen, ScreenHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';

export default function NewChatScreen() {
  return <PeopleList />;
}

function PeopleList() {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const searching = Boolean(search.trim());

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <ScreenHeader title="New chat" />
      </View>
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            autoFocus
            accessibilityLabel="Search people on Macronaut"
            value={search}
            onChangeText={setSearch}
            placeholder="Search people on Macronaut"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ChatPeopleList
        search={search}
        navigate="replace"
        label={searching ? 'PEOPLE ON MACRONAUT' : 'CONTACTS'}
        empty={
          <EmptyState
            title={searching ? 'No people found' : 'No contacts yet'}
            body={
              searching
                ? 'Search the whole @handle to find someone whose profile page is private.'
                : 'Search for someone on Macronaut to start your first conversation.'
            }
          />
        }
      />

      {searching ? null : (
        <AppText variant="caption" tone="muted" style={styles.hint}>
          Add someone as a friend, and message them once they accept.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  search: {
    minHeight: touchTarget,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0 } as object,
      default: {},
    }),
  },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    textAlign: 'center',
  },
});
