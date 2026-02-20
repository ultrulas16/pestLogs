import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Package, Beaker, Wrench, Trash2, CreditCard as Edit2, DollarSign, Calendar, Bug, Check } from 'lucide-react-native';
import { DesktopLayout } from '@/components/DesktopLayout';
import { EQUIPMENT_TYPES, getEquipmentTypeLabel } from '@/constants/equipment-types';

interface Material {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  price: number | null;
  currency: string;
  is_active: boolean;
}

interface BiocidalProduct {
  id: string;
  name: string;
  description: string | null;
  active_ingredient: string | null;
  concentration: string | null;
  unit: string | null;
  is_active: boolean;
}

interface Property {
  type: 'string' | 'number' | 'boolean';
  label: string;
}

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  equipment_type: string | null;
  quantity: number;
  is_active: boolean;
  properties?: Record<string, Property>;
}

interface VisitType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface TargetPest {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

type TabType = 'materials' | 'biocidal' | 'equipment' | 'visit_types' | 'target_pests';

export default function CompanyDefinitions() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { profile, user } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [biocidalProducts, setBiocidalProducts] = useState<BiocidalProduct[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  const [targetPests, setTargetPests] = useState<TargetPest[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [concentration, setConcentration] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [currency, setCurrency] = useState('usd');

  // Property management state
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [propertyLabel, setPropertyLabel] = useState('');
  const [propertyType, setPropertyType] = useState<'string' | 'number' | 'boolean'>('string');
  const [equipmentProperties, setEquipmentProperties] = useState<Record<string, Property>>({});

  useEffect(() => {
    loadCompanyId();
  }, [user]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [activeTab, companyId]);

  const loadCompanyId = async () => {
    try {
      if (!user?.id) return;

      // Query the companies table to get the company ID
      // Note: The schema has company_id referencing profiles.id, but the actual data
      // uses companies.id. This is a schema design issue that needs to be fixed.
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Use the company ID from companies table to match existing data
      setCompanyId(companyData?.id || null);
    } catch (error) {
      console.error('Error loading company ID:', error);
      setCompanyId(null);
    }
  };

  const loadData = async () => {
    try {
      switch (activeTab) {
        case 'materials':
          await loadMaterials();
          break;
        case 'biocidal':
          await loadBiocidalProducts();
          break;
        case 'equipment':
          await loadEquipment();
          break;
        case 'visit_types':
          await loadVisitTypes();
          break;
        case 'target_pests':
          await loadTargetPests();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadMaterials = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('company_materials')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setMaterials(data || []);
  };

  const loadBiocidalProducts = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('company_biocidal_products')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setBiocidalProducts(data || []);
  };

  const loadEquipment = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('company_equipment')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setEquipment(data || []);
  };

  const loadVisitTypes = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('company_visit_types')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setVisitTypes(data || []);
  };

  const loadTargetPests = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('company_target_pests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setTargetPests(data || []);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), 'Name is required');
      return;
    }

    setLoading(true);
    try {
      if (editingItem) {
        await updateItem();
      } else {
        await createItem();
      }
      resetForm();
      await loadData();
    } catch (error: any) {
      Alert.alert(t('error'), error.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const createItem = async () => {
    if (!companyId) {
      throw new Error('Company ID not found. Please refresh the page and try again.');
    }

    console.log('Creating item with company_id:', companyId);
    console.log('Active tab:', activeTab);

    const baseData = {
      company_id: companyId,
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
    };

    switch (activeTab) {
      case 'materials':
        const { error: materialsError } = await supabase.from('company_materials').insert({
          ...baseData,
          unit: unit.trim() || null,
          price: price ? parseFloat(price) : null,
          currency: currency,
        });
        if (materialsError) {
          console.error('Materials insert error:', materialsError);
          throw materialsError;
        }
        break;
      case 'biocidal':
        const { error: biocidalError } = await supabase.from('company_biocidal_products').insert({
          ...baseData,
          active_ingredient: activeIngredient.trim() || null,
          concentration: concentration.trim() || null,
          unit: unit.trim() || null,
        });
        if (biocidalError) {
          console.error('Biocidal insert error:', biocidalError);
          throw biocidalError;
        }
        break;
      case 'equipment':
        if (!equipmentType.trim()) {
          throw new Error('Equipment type is required');
        }
        console.log('Inserting equipment with type:', equipmentType);
        const { error: equipmentError } = await supabase.from('company_equipment').insert({
          ...baseData,
          equipment_type: equipmentType.trim(),
          properties: equipmentProperties,
        });
        if (equipmentError) {
          console.error('Equipment insert error:', equipmentError);
          console.error('Error details:', JSON.stringify(equipmentError, null, 2));
          throw equipmentError;
        }
        break;
      case 'visit_types':
        const { error: visitTypesError } = await supabase.from('company_visit_types').insert({
          ...baseData,
        });
        if (visitTypesError) {
          console.error('Visit types insert error:', visitTypesError);
          throw visitTypesError;
        }
        break;
      case 'target_pests':
        const { error: targetPestsError } = await supabase.from('company_target_pests').insert({
          ...baseData,
        });
        if (targetPestsError) {
          console.error('Target pests insert error:', targetPestsError);
          throw targetPestsError;
        }
        break;
    }
  };

  const updateItem = async () => {
    const baseData = {
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
    };

    switch (activeTab) {
      case 'materials':
        await supabase.from('company_materials').update({
          ...baseData,
          unit: unit.trim() || null,
          price: price ? parseFloat(price) : null,
          currency: currency,
        }).eq('id', editingItem.id);
        break;
      case 'biocidal':
        await supabase.from('company_biocidal_products').update({
          ...baseData,
          active_ingredient: activeIngredient.trim() || null,
          concentration: concentration.trim() || null,
          unit: unit.trim() || null,
        }).eq('id', editingItem.id);
        break;
      case 'equipment':
        const { error: equipmentUpdateError } = await supabase.from('company_equipment').update({
          ...baseData,
          equipment_type: equipmentType.trim() || null,
          properties: equipmentProperties,
        }).eq('id', editingItem.id);
        if (equipmentUpdateError) throw equipmentUpdateError;
        break;
      case 'visit_types':
        await supabase.from('company_visit_types').update({
          ...baseData,
        }).eq('id', editingItem.id);
        break;
      case 'target_pests':
        await supabase.from('company_target_pests').update({
          ...baseData,
        }).eq('id', editingItem.id);
        break;
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      getDeleteTitle(),
      'Are you sure you want to delete this item?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const tableName = getTableName();
              await supabase.from(tableName).delete().eq('id', id);
              await loadData();
            } catch (error: any) {
              Alert.alert(t('error'), error.message || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const getDeleteTitle = () => {
    switch (activeTab) {
      case 'materials': return t('deleteMaterial');
      case 'biocidal': return t('deleteBiocidalProduct');
      case 'equipment': return t('deleteEquipment');
      case 'visit_types': return t('deleteVisitType');
      case 'target_pests': return t('deleteTargetPest');
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || '');
    setUnit(item.unit || '');
    setPrice(item.price?.toString() || '');
    setCurrency(item.currency || 'usd');
    setActiveIngredient(item.active_ingredient || '');
    setConcentration(item.concentration || '');
    setEquipmentType(item.equipment_type || '');
    setEquipmentProperties(item.properties || {});
    setIsActive(item.is_active ?? true);
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setName('');
    setDescription('');
    setUnit('');
    setPrice('');
    setCurrency('usd');
    setActiveIngredient('');
    setConcentration('');
    setEquipmentType('');
    setEquipmentProperties({});
    setIsActive(true);
  };

  // Property management functions
  const handleAddProperty = () => {
    if (!propertyLabel.trim()) {
      Alert.alert(t('error'), 'Property label is required');
      return;
    }

    const propertyKey = propertyLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const newProperty: Property = {
      type: propertyType,
      label: propertyLabel,
    };

    setEquipmentProperties(prev => ({
      ...prev,
      [propertyKey]: newProperty,
    }));

    setShowPropertyModal(false);
    setPropertyLabel('');
    setPropertyType('string');
  };

  const handleDeleteProperty = (propertyKey: string) => {
    setEquipmentProperties(prev => {
      const newProperties = { ...prev };
      delete newProperties[propertyKey];
      return newProperties;
    });
  };

  const getTableName = () => {
    switch (activeTab) {
      case 'materials': return 'company_materials';
      case 'biocidal': return 'company_biocidal_products';
      case 'equipment': return 'company_equipment';
      case 'visit_types': return 'company_visit_types';
      case 'target_pests': return 'company_target_pests';
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'materials': return materials;
      case 'biocidal': return biocidalProducts;
      case 'equipment': return equipment;
      case 'visit_types': return visitTypes;
      case 'target_pests': return targetPests;
    }
  };

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'materials': return <Package size={20} color={activeTab === tab ? '#4caf50' : '#666'} />;
      case 'biocidal': return <Beaker size={20} color={activeTab === tab ? '#4caf50' : '#666'} />;
      case 'equipment': return <Wrench size={20} color={activeTab === tab ? '#4caf50' : '#666'} />;
      case 'visit_types': return <Calendar size={20} color={activeTab === tab ? '#4caf50' : '#666'} />;
      case 'target_pests': return <Bug size={20} color={activeTab === tab ? '#4caf50' : '#666'} />;
    }
  };

  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'materials': return t('materials');
      case 'biocidal': return t('biocidalProducts');
      case 'equipment': return t('equipment');
      case 'visit_types': return t('visitTypes');
      case 'target_pests': return t('targetPests');
    }
  };

  const getCurrencySymbol = (currencyCode: string) => {
    const symbols: Record<string, string> = {
      usd: '$',
      eur: '€',
      try: '₺',
      azn: '₼',
      sar: '﷼',
      gbp: '£',
    };
    return symbols[currencyCode] || '$';
  };

  const getCurrencyName = (currencyCode: string) => {
    const names: Record<string, string> = {
      usd: 'USD',
      eur: 'EUR',
      try: 'TRY',
      azn: 'AZN',
      sar: 'SAR',
      gbp: 'GBP',
    };
    return names[currencyCode] || 'USD';
  };

  const renderFormFields = () => {
    return (
      <>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={getNamePlaceholder()}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={t('description')}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {(activeTab === 'materials' || activeTab === 'biocidal') && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('unit')}
                value={unit}
                onChangeText={setUnit}
              />
            </View>

            {activeTab === 'materials' && (
              <View style={styles.priceContainer}>
                <View style={styles.priceInputContainer}>
                  <DollarSign size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.priceInput}
                    placeholder={`${t('price')} (${getCurrencySymbol(currency)} - ${getCurrencyName(currency)})`}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.currencyContainer}>
                  <Text style={styles.currencyLabel}>{t('currency')}</Text>
                  <ScrollView horizontal style={styles.currencyPicker} showsHorizontalScrollIndicator={false}>
                    {[
                      { code: 'usd', name: t('usd') },
                      { code: 'eur', name: t('eur') },
                      { code: 'try', name: t('try') },
                      { code: 'azn', name: t('azn') },
                      { code: 'sar', name: t('sar') },
                      { code: 'gbp', name: t('gbp') },
                    ].map((curr) => (
                      <TouchableOpacity
                        key={curr.code}
                        style={[
                          styles.currencyOption,
                          currency === curr.code && styles.currencyOptionSelected,
                        ]}
                        onPress={() => setCurrency(curr.code)}
                      >
                        <Text
                          style={[
                            styles.currencyOptionText,
                            currency === curr.code && styles.currencyOptionTextSelected,
                          ]}
                        >
                          {curr.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === 'biocidal' && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('activeIngredient')}
                value={activeIngredient}
                onChangeText={setActiveIngredient}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('concentration')}
                value={concentration}
                onChangeText={setConcentration}
              />
            </View>
          </>
        )}

        {activeTab === 'equipment' && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('equipmentType')}</Text>
            <ScrollView
              horizontal
              style={styles.typeScroll}
              contentContainerStyle={styles.typeScrollContent}
              showsHorizontalScrollIndicator={false}
            >
              {Object.values(EQUIPMENT_TYPES).map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeOption,
                    equipmentType === type.id && styles.typeOptionSelected
                  ]}
                  onPress={() => setEquipmentType(type.id)}
                >
                  {equipmentType === type.id && (
                    <Check size={16} color="#4caf50" style={styles.checkIcon} />
                  )}
                  <Text style={[
                    styles.typeOptionText,
                    equipmentType === type.id && styles.typeOptionTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {activeTab === 'equipment' && (
          <View style={styles.propertiesContainer}>
            <View style={styles.propertiesHeader}>
              <Text style={styles.propertiesTitle}>Ekipman Özellikleri</Text>
              <TouchableOpacity
                style={styles.addPropertyButton}
                onPress={() => setShowPropertyModal(true)}
              >
                <Plus size={16} color="#4caf50" />
                <Text style={styles.addPropertyText}>Özellik Ekle</Text>
              </TouchableOpacity>
            </View>

            {Object.keys(equipmentProperties).length > 0 ? (
              <View style={styles.propertiesList}>
                {Object.entries(equipmentProperties).map(([key, property]) => (
                  <View key={key} style={styles.propertyItem}>
                    <View style={styles.propertyInfo}>
                      <Text style={styles.propertyLabel}>{property.label}</Text>
                      <Text style={styles.propertyType}>
                        {property.type === 'string' ? 'Metin' : property.type === 'number' ? 'Sayı' : 'Evet/Hayır'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteProperty(key)}
                      style={styles.deletePropertyButton}
                    >
                      <Trash2 size={16} color="#f44336" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noPropertiesText}>Özellik tanımlanmamış</Text>
            )}
          </View>
        )}

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>{t('active')}</Text>
          <TouchableOpacity
            style={[styles.switch, isActive && styles.switchActive]}
            onPress={() => setIsActive(!isActive)}
          >
            <View style={[styles.switchThumb, isActive && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const getNamePlaceholder = () => {
    switch (activeTab) {
      case 'materials': return t('materialName') + ' *';
      case 'biocidal': return t('productName') + ' *';
      case 'equipment': return t('equipmentName') + ' *';
      case 'visit_types': return t('visitTypeName') + ' *';
      case 'target_pests': return t('targetPestName') + ' *';
    }
  };

  const renderDesktopTableHeader = () => {
    switch (activeTab) {
      case 'materials':
        return (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('materialName')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>{t('description')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('unit')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('price')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('status')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Actions</Text>
          </View>
        );
      case 'biocidal':
        return (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('productName')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('description')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('activeIngredient')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('concentration')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('status')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Actions</Text>
          </View>
        );
      case 'equipment':
        return (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('equipmentName')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>{t('description')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('equipmentType')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('status')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Actions</Text>
          </View>
        );
      case 'visit_types':
        return (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('visitTypeName')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 4 }]}>{t('description')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('status')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Actions</Text>
          </View>
        );
      case 'target_pests':
        return (
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{t('targetPestName')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 4 }]}>{t('description')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>{t('status')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Actions</Text>
          </View>
        );
    }
  };

  const renderDesktopTableRow = (item: any) => {
    switch (activeTab) {
      case 'materials':
        return (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellText, { flex: 2, fontWeight: '500' }]}>{item.name}</Text>
            <Text style={[styles.tableCellText, { flex: 3 }]}>{item.description || '-'}</Text>
            <Text style={[styles.tableCellText, { flex: 1 }]}>{item.unit || '-'}</Text>
            <Text style={[styles.tableCellText, { flex: 1 }]}>
              {item.price ? `${getCurrencySymbol(item.currency || 'usd')}${item.price}` : '-'}
            </Text>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText, { fontSize: 12 }]}>
                  {item.is_active ? t('active') : t('inactive')}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.desktopActionBtn}>
                <Edit2 size={18} color="#2196f3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.desktopActionBtn}>
                <Trash2 size={18} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'biocidal':
        return (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellText, { flex: 2, fontWeight: '500' }]}>{item.name}</Text>
            <Text style={[styles.tableCellText, { flex: 2 }]}>{item.description || '-'}</Text>
            <Text style={[styles.tableCellText, { flex: 2 }]}>{item.active_ingredient || '-'}</Text>
            <Text style={[styles.tableCellText, { flex: 1 }]}>{item.concentration || '-'}</Text>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText, { fontSize: 12 }]}>
                  {item.is_active ? t('active') : t('inactive')}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.desktopActionBtn}>
                <Edit2 size={18} color="#2196f3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.desktopActionBtn}>
                <Trash2 size={18} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'equipment':
        return (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellText, { flex: 2, fontWeight: '500' }]}>{item.name}</Text>
            <Text style={[styles.tableCellText, { flex: 3 }]}>{item.description || '-'}</Text>
            <Text style={[styles.tableCellText, { flex: 2 }]}>{getEquipmentTypeLabel(item.equipment_type) || item.equipment_type || '-'}</Text>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText, { fontSize: 12 }]}>
                  {item.is_active ? t('active') : t('inactive')}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.desktopActionBtn}>
                <Edit2 size={18} color="#2196f3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.desktopActionBtn}>
                <Trash2 size={18} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'visit_types':
      case 'target_pests':
        return (
          <View key={item.id} style={styles.tableRow}>
            <Text style={[styles.tableCellText, { flex: 2, fontWeight: '500' }]}>{item.name}</Text>
            <Text style={[styles.tableCellText, { flex: 4 }]}>{item.description || '-'}</Text>
            <View style={{ flex: 1 }}>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge, { alignSelf: 'flex-start' }]}>
                <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText, { fontSize: 12 }]}>
                  {item.is_active ? t('active') : t('inactive')}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => startEdit(item)} style={styles.desktopActionBtn}>
                <Edit2 size={18} color="#2196f3" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.desktopActionBtn}>
                <Trash2 size={18} color="#f44336" />
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  const renderListItem = (item: any) => {
    return (
      <View key={item.id} style={styles.listItem}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDescription}>{item.description}</Text>
          )}
          <View style={styles.itemDetails}>
            {item.unit && <Text style={styles.itemDetail}>Unit: {item.unit}</Text>}
            {item.price && activeTab === 'materials' && <Text style={styles.itemDetail}>{t('price')}: {getCurrencySymbol(item.currency || 'usd')}{item.price}</Text>}
            {item.active_ingredient && <Text style={styles.itemDetail}>{t('activeIngredient')}: {item.active_ingredient}</Text>}
            {item.concentration && <Text style={styles.itemDetail}>{t('concentration')}: {item.concentration}</Text>}
            {item.equipment_type && <Text style={styles.itemDetail}>{t('equipmentType')}: {getEquipmentTypeLabel(item.equipment_type) || item.equipment_type}</Text>}
          </View>
          <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText]}>
              {item.is_active ? t('active') : t('inactive')}
            </Text>
          </View>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={() => startEdit(item)} style={styles.editButton}>
            <Edit2 size={20} color="#2196f3" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteButton}>
            <Trash2 size={20} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const Content = () => (
    <View style={{ flex: 1 }}>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('companyDefinitions')}</Text>
          <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addButton}>
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <View style={isDesktop && styles.desktopContentContainer}>
        {isDesktop && (
          <View style={styles.desktopHeaderRow}>
            <Text style={styles.desktopTitle}>{t('companyDefinitions')}</Text>
            <TouchableOpacity onPress={() => setShowForm(true)} style={styles.desktopAddButton}>
              <Plus size={20} color="#fff" />
              <Text style={styles.desktopAddButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.tabContainer, isDesktop && styles.desktopTabContainer]}>
          {(['materials', 'biocidal', 'equipment', 'visit_types', 'target_pests'] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab, isDesktop && styles.desktopTab]}
              onPress={() => setActiveTab(tab)}
            >
              {getTabIcon(tab)}
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {getTabTitle(tab)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content}>
          <View style={[styles.listContainer, isDesktop && styles.desktopListContainer]}>
            {!isDesktop && (
              <Text style={styles.listTitle}>
                {getTabTitle(activeTab)} ({getCurrentData().length})
              </Text>
            )}
            {getCurrentData().length === 0 ? (
              <Text style={styles.emptyText}>{t('noData')}</Text>
            ) : isDesktop ? (
              <View style={styles.tableContainer}>
                {renderDesktopTableHeader()}
                {getCurrentData().map((item) => renderDesktopTableRow(item))}
              </View>
            ) : (
              <View>
                {getCurrentData().map((item) => renderListItem(item))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.desktopModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.formTitle}>
                {editingItem ? t('edit') : t('create')} {getTabTitle(activeTab)}
              </Text>
              {isDesktop && (
                <TouchableOpacity onPress={resetForm} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView>
              {renderFormFields()}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? t('loading') : editingItem ? t('update') : t('create')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Property Modal */}
      <Modal visible={showPropertyModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.desktopModalContent, { maxHeight: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.formTitle}>Ekipman Özelliği Ekle</Text>
              {isDesktop && (
                <TouchableOpacity onPress={() => setShowPropertyModal(false)} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Özellik Adı *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Karasinek Sayısı"
                value={propertyLabel}
                onChangeText={setPropertyLabel}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Veri Tipi</Text>
              <View style={styles.typeScroll}>
                {[
                  { id: 'string', label: 'Metin' },
                  { id: 'number', label: 'Sayı' },
                  { id: 'boolean', label: 'Evet/Hayır' }
                ].map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeOption,
                      propertyType === type.id && styles.typeOptionSelected
                    ]}
                    onPress={() => setPropertyType(type.id as any)}
                  >
                    {propertyType === type.id && (
                      <Check size={16} color="#4caf50" style={styles.checkIcon} />
                    )}
                    <Text style={[
                      styles.typeOptionText,
                      propertyType === type.id && styles.typeOptionTextSelected
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPropertyModal(false)}>
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddProperty}
              >
                <Text style={styles.submitButtonText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isDesktop) {
    return (
      <DesktopLayout>
        <Content />
      </DesktopLayout>
    );
  }

  return (
    <View style={styles.container}>
      <Content />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4caf50',
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#e8f5e9',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4caf50',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  listContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  typeScroll: {
    marginBottom: 8,
  },
  typeScrollContent: {
    paddingRight: 16,
    gap: 8,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  typeOptionSelected: {
    borderColor: '#4caf50',
    backgroundColor: '#e8f5e9',
  },
  checkIcon: {
    marginRight: 6,
  },
  typeOptionText: {
    fontSize: 14,
    color: '#666',
  },
  typeOptionTextSelected: {
    color: '#4caf50',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  itemDetails: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  priceContainer: {
    marginBottom: 12,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  currencyContainer: {
    marginTop: 4,
  },
  currencyLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  currencyPicker: {
    flexDirection: 'row',
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  currencyOptionSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  currencyOptionText: {
    fontSize: 12,
    color: '#666',
  },
  currencyOptionTextSelected: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#4caf50',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    transform: [{ translateX: 0 }],
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4caf50',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  activeBadge: {
    backgroundColor: '#e8f5e9',
  },
  inactiveBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeText: {
    color: '#4caf50',
  },
  inactiveText: {
    color: '#f44336',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  desktopContentContainer: {
    flex: 1,
    padding: 32,
  },
  desktopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  desktopAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  desktopAddButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  desktopTabContainer: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 8,
  },
  desktopTab: {
    flex: 0,
    minWidth: 120,
    marginHorizontal: 8,
  },
  desktopListContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    elevation: 0,
    padding: 0,
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  desktopCard: {
    width: '32%', // Approx 1/3
    minWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  desktopModalContent: {
    width: '50%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },

  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    paddingVertical: 40,
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableHeaderCell: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCellText: {
    fontSize: 14,
    color: '#333',
  },
  desktopActionBtn: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Property management styles
  propertiesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  propertiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  propertiesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  addPropertyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f5e9',
    borderRadius: 6,
  },
  addPropertyText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#4caf50',
    fontWeight: '500',
  },
  propertiesList: {
    gap: 8,
  },
  propertyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  propertyInfo: {
    flex: 1,
  },
  propertyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  propertyType: {
    fontSize: 12,
    color: '#666',
  },
  deletePropertyButton: {
    padding: 6,
  },
  noPropertiesText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});