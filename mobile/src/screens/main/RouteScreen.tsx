import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../context/LocationContext';
import { COLORS, APP_CONFIG } from '../../config';

interface Stop {
  id: string;
  address: string;
  type: 'pickup' | 'delivery';
  status: 'pending' | 'current' | 'completed';
  customer: string;
  phone: string;
  eta: string;
}

const mockStops: Stop[] = [
  {
    id: '1',
    address: 'Tech Park, Andheri East',
    type: 'pickup',
    status: 'completed',
    customer: 'Tech Solutions',
    phone: '+91 98765 43210',
    eta: '9:30 AM',
  },
  {
    id: '2',
    address: 'Hill Road, Bandra West',
    type: 'delivery',
    status: 'current',
    customer: 'Rahul Sharma',
    phone: '+91 98765 11111',
    eta: '10:15 AM',
  },
  {
    id: '3',
    address: 'Linking Road, Bandra',
    type: 'delivery',
    status: 'pending',
    customer: 'Priya Patel',
    phone: '+91 98765 22222',
    eta: '10:45 AM',
  },
  {
    id: '4',
    address: 'SV Road, Malad West',
    type: 'delivery',
    status: 'pending',
    customer: 'Fresh Groceries',
    phone: '+91 98765 33333',
    eta: '11:30 AM',
  },
];

export default function RouteScreen() {
  const { location } = useLocation();
  const [stops] = useState<Stop[]>(mockStops);
  const currentStop = stops.find(s => s.status === 'current');
  const completedCount = stops.filter(s => s.status === 'completed').length;
  const progress = (completedCount / stops.length) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map" size={48} color={COLORS.textMuted} />
          <Text style={styles.mapPlaceholderText}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : 'Map View'}
          </Text>
          <Text style={styles.mapNote}>
            Install react-native-maps for full map functionality
          </Text>
        </View>
        
        {/* Floating Stats */}
        <View style={styles.floatingStats}>
          <View style={styles.floatingStat}>
            <Text style={styles.floatingStatValue}>{stops.length - completedCount}</Text>
            <Text style={styles.floatingStatLabel}>Stops Left</Text>
          </View>
          <View style={styles.floatingStatDivider} />
          <View style={styles.floatingStat}>
            <Text style={styles.floatingStatValue}>~45</Text>
            <Text style={styles.floatingStatLabel}>Min ETA</Text>
          </View>
          <View style={styles.floatingStatDivider} />
          <View style={styles.floatingStat}>
            <Text style={styles.floatingStatValue}>12.5</Text>
            <Text style={styles.floatingStatLabel}>Km Left</Text>
          </View>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Route Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressSubtext}>
            {completedCount} of {stops.length} stops completed
          </Text>
        </View>

        {/* Current Stop */}
        {currentStop && (
          <View style={styles.currentStopCard}>
            <View style={styles.currentStopHeader}>
              <View style={styles.currentStopBadge}>
                <Text style={styles.currentStopBadgeText}>CURRENT STOP</Text>
              </View>
              <TouchableOpacity style={styles.navigateButton}>
                <Ionicons name="navigate" size={20} color={COLORS.text} />
                <Text style={styles.navigateText}>Navigate</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.currentStopContent}>
              <View style={styles.stopTypeIndicator}>
                <Ionicons
                  name={currentStop.type === 'pickup' ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={24}
                  color={currentStop.type === 'pickup' ? COLORS.success : COLORS.primary}
                />
              </View>
              <View style={styles.currentStopInfo}>
                <Text style={styles.currentStopAddress}>{currentStop.address}</Text>
                <Text style={styles.currentStopCustomer}>{currentStop.customer}</Text>
                <View style={styles.currentStopMeta}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.currentStopEta}>ETA: {currentStop.eta}</Text>
                </View>
              </View>
            </View>
            <View style={styles.currentStopActions}>
              <TouchableOpacity style={styles.callButton}>
                <Ionicons name="call" size={20} color={COLORS.info} />
                <Text style={[styles.actionButtonText, { color: COLORS.info }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.completeButton}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.text} />
                <Text style={styles.completeButtonText}>Mark Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stop List */}
        <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
          <Text style={styles.stopsListTitle}>All Stops</Text>
          {stops.map((stop, index) => (
            <TouchableOpacity key={stop.id} style={styles.stopItem}>
              <View style={styles.stopTimeline}>
                <View
                  style={[
                    styles.stopDot,
                    stop.status === 'completed' && styles.stopDotCompleted,
                    stop.status === 'current' && styles.stopDotCurrent,
                  ]}
                />
                {index < stops.length - 1 && (
                  <View
                    style={[
                      styles.stopLine,
                      stop.status === 'completed' && styles.stopLineCompleted,
                    ]}
                  />
                )}
              </View>
              <View style={styles.stopContent}>
                <View style={styles.stopHeader}>
                  <Text
                    style={[
                      styles.stopAddress,
                      stop.status === 'completed' && styles.stopAddressCompleted,
                    ]}
                  >
                    {stop.address}
                  </Text>
                  <View
                    style={[
                      styles.stopTypeBadge,
                      { backgroundColor: (stop.type === 'pickup' ? COLORS.success : COLORS.primary) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopTypeText,
                        { color: stop.type === 'pickup' ? COLORS.success : COLORS.primary },
                      ]}
                    >
                      {stop.type}
                    </Text>
                  </View>
                </View>
                <Text style={styles.stopCustomer}>{stop.customer}</Text>
                <Text style={styles.stopEta}>{stop.eta}</Text>
              </View>
              {stop.status === 'completed' && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    height: height * 0.35,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: COLORS.textSecondary,
    marginTop: 8,
    fontSize: 16,
  },
  mapNote: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  floatingStats: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    flexDirection: 'row',
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  floatingStat: {
    flex: 1,
    alignItems: 'center',
  },
  floatingStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  floatingStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  floatingStatDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.card,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  currentStopCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  currentStopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentStopBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentStopBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  navigateText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  currentStopContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stopTypeIndicator: {
    marginRight: 12,
  },
  currentStopInfo: {
    flex: 1,
  },
  currentStopAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  currentStopCustomer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  currentStopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentStopEta: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  currentStopActions: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info + '20',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  completeButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  stopsList: {
    flex: 1,
  },
  stopsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  stopItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  stopTimeline: {
    alignItems: 'center',
    marginRight: 12,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  stopDotCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  stopDotCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stopLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
  },
  stopLineCompleted: {
    backgroundColor: COLORS.success,
  },
  stopContent: {
    flex: 1,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  stopAddressCompleted: {
    color: COLORS.textMuted,
  },
  stopTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stopTypeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stopCustomer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  stopEta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
