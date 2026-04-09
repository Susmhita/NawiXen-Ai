import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config';

interface Delivery {
  id: string;
  orderId: string;
  customer: string;
  address: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed';
  time: string;
  amount: string;
}

const mockDeliveries: Delivery[] = [
  {
    id: '1',
    orderId: 'ORD-001',
    customer: 'Rahul Sharma',
    address: 'Hill Road, Bandra West',
    status: 'in_transit',
    time: '10:15 AM',
    amount: '₹2,500',
  },
  {
    id: '2',
    orderId: 'ORD-002',
    customer: 'Priya Patel',
    address: 'Linking Road, Bandra',
    status: 'pending',
    time: '10:45 AM',
    amount: '₹1,800',
  },
  {
    id: '3',
    orderId: 'ORD-003',
    customer: 'Fresh Groceries',
    address: 'SV Road, Malad West',
    status: 'pending',
    time: '11:30 AM',
    amount: '₹5,200',
  },
  {
    id: '4',
    orderId: 'ORD-004',
    customer: 'Tech Solutions',
    address: 'Tech Park, Andheri East',
    status: 'delivered',
    time: '9:30 AM',
    amount: '₹8,500',
  },
  {
    id: '5',
    orderId: 'ORD-005',
    customer: 'Medical Supplies',
    address: 'Powai, Mumbai',
    status: 'delivered',
    time: '8:45 AM',
    amount: '₹3,200',
  },
];

const statusConfig = {
  pending: { color: COLORS.warning, label: 'Pending', icon: 'time-outline' as const },
  in_transit: { color: COLORS.primary, label: 'In Transit', icon: 'car-outline' as const },
  delivered: { color: COLORS.success, label: 'Delivered', icon: 'checkmark-circle-outline' as const },
  failed: { color: COLORS.error, label: 'Failed', icon: 'close-circle-outline' as const },
};

export default function DeliveriesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all');

  const filteredDeliveries = mockDeliveries.filter(delivery => {
    const matchesSearch = 
      delivery.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.customer.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'pending') return matchesSearch && (delivery.status === 'pending' || delivery.status === 'in_transit');
    if (filter === 'delivered') return matchesSearch && delivery.status === 'delivered';
    return matchesSearch;
  });

  const stats = {
    total: mockDeliveries.length,
    completed: mockDeliveries.filter(d => d.status === 'delivered').length,
    pending: mockDeliveries.filter(d => d.status === 'pending' || d.status === 'in_transit').length,
  };

  const renderDeliveryItem = ({ item }: { item: Delivery }) => {
    const status = statusConfig[item.status];
    
    return (
      <TouchableOpacity style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <Text style={styles.orderId}>{item.orderId}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        
        <View style={styles.deliveryContent}>
          <View style={styles.deliveryInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.customerName}>{item.customer}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            </View>
            <View style={styles.deliveryMeta}>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{item.time}</Text>
              </View>
              <Text style={styles.amount}>{item.amount}</Text>
            </View>
          </View>
        </View>
        
        {item.status !== 'delivered' && (
          <View style={styles.deliveryActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call-outline" size={18} color={COLORS.info} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchText}
            placeholder="Search orders..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'pending', 'delivered'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Deliveries List */}
      <FlatList
        data={filteredDeliveries}
        renderItem={renderDeliveryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No deliveries found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  deliveryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deliveryContent: {
    flexDirection: 'row',
  },
  deliveryInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  address: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  deliveryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deliveryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 12,
  },
});
