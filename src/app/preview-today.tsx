import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TodayDashboard, TODAY } from '@/ui/components/TodayDashboard';
import { AppText } from '@/ui/components/AppText';
import { fonts } from '@/ui/theme/tokens';

const REFERENCE_MACROS = [
  { label: 'Carbs', consumed: 0, target: 185, bar: TODAY.carbsBar },
  { label: 'Protein', consumed: 0, target: 74, bar: TODAY.proteinBar },
  { label: 'Fat', consumed: 0, target: 49, bar: TODAY.fatBar },
];

/**
 * Ungated visual clone of the diary reference (lime remaining ring + macros)
 * so the layout can be inspected without signing in. Remove once the Today
 * redesign has shipped.
 */
export default function PreviewTodayScreen() {
  return (
    <View style={styles.page}>
      <IPhoneFrame>
        <TodayDashboard
          dateLabel="TODAY, 15 JUL"
          consumed={0}
          burned={0}
          remaining={14779}
          goal={14779}
          macros={REFERENCE_MACROS}
          topInset={54}
          minHeight={844 - 8}
        />
      </IPhoneFrame>
    </View>
  );
}

function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.phone}>
      <View style={styles.island} />
      <View style={styles.statusBar} pointerEvents="none">
        <AppText style={styles.time}>9:41</AppText>
        <View style={styles.statusIcons}>
          <SignalBars />
          <WifiMark />
          <BatteryMark />
        </View>
      </View>
      {children}
    </View>
  );
}

function SignalBars() {
  return (
    <View style={styles.signal}>
      {[4, 7, 10, 13].map((h, i) => (
        <View key={i} style={[styles.bar, { height: h, opacity: i === 0 ? 0.35 : 1 }]} />
      ))}
    </View>
  );
}

function WifiMark() {
  return (
    <View style={styles.wifi}>
      <View style={styles.wifiArc} />
      <View style={styles.wifiDot} />
    </View>
  );
}

function BatteryMark() {
  return (
    <View style={styles.batteryWrap}>
      <View style={styles.battery}>
        <View style={styles.batteryFill} />
      </View>
      <View style={styles.batteryNip} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 390,
    height: 844,
    borderRadius: 47,
    overflow: 'hidden',
    backgroundColor: TODAY.limeTop,
  },
  island: {
    position: 'absolute',
    top: 11,
    alignSelf: 'center',
    left: (390 - 126) / 2,
    width: 126,
    height: 37,
    borderRadius: 19,
    backgroundColor: '#000000',
    zIndex: 4,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    paddingHorizontal: 28,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  time: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 19,
    color: '#111111',
    letterSpacing: -0.3,
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 4,
  },
  signal: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 13,
  },
  bar: {
    width: 3,
    borderRadius: 1,
    backgroundColor: '#111111',
  },
  wifi: {
    width: 16,
    height: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  wifiArc: {
    width: 14,
    height: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    borderColor: '#111111',
    borderBottomWidth: 0,
  },
  wifiDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#111111',
    marginTop: 1,
  },
  batteryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  battery: {
    width: 24,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.2,
    borderColor: '#111111',
    padding: 1.5,
  },
  batteryFill: {
    flex: 1,
    borderRadius: 1.5,
    backgroundColor: '#111111',
  },
  batteryNip: {
    width: 2,
    height: 5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    backgroundColor: '#111111',
    marginLeft: 1,
    opacity: 0.7,
  },
});
