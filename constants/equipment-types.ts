export const EQUIPMENT_TYPES = {
    RODENT_BAIT_STATION: {
        id: 'rodent_bait_station',
        label: 'Yemli Kemirgen İstasyonu',
        controls: [
            { key: 'poison_consumption', label: 'Zehir Tüketimi', type: 'boolean' },
            { key: 'activity', label: 'Aktivite', type: 'boolean' },
        ]
    },
    LIVE_CAPTURE: {
        id: 'live_capture',
        label: 'Canlı Yakalama İstasyonu',
        controls: [
            { key: 'activity', label: 'Aktivite', type: 'boolean' },
            { key: 'species', label: 'Tür', type: 'text' },
            { key: 'count', label: 'Adet', type: 'number' },
        ]
    },
    INSECT_LIGHT_TRAP: {
        id: 'insect_light_trap',
        label: 'Sinek Kontrol Cihazı (E.F.K)',
        controls: [
            { key: 'house_fly', label: 'Karasinek', type: 'number' },
            { key: 'fruit_fly', label: 'Meyve Sineği', type: 'number' },
            { key: 'moth', label: 'Güve', type: 'number' },
            { key: 'mosquito', label: 'Sivrisinek', type: 'number' },
            { key: 'other', label: 'Diğer', type: 'number' },
        ]
    },
    PHEROMONE_TRAP: {
        id: 'pheromone_trap',
        label: 'Feromon Tuzağı',
        controls: [
            { key: 'moth', label: 'Güve', type: 'number' },
            { key: 'beetle', label: 'Böcek', type: 'number' },
        ]
    },
    STORED_PRODUCT_TRAP: {
        id: 'stored_product_trap',
        label: 'Ambar Zararlı Tuzağı',
        controls: [
            { key: 'count', label: 'Adet', type: 'number' },
            { key: 'species', label: 'Tür', type: 'text' },
        ]
    },
    BIRD_CONTROL: {
        id: 'bird_control',
        label: 'Kuş Kontrol Cihazı',
        controls: [
            { key: 'activity', label: 'Aktivite', type: 'boolean' },
            { key: 'maintenance', label: 'Bakım Yapıldı', type: 'boolean' },
        ]
    },
    PEST_MONITOR: {
        id: 'pest_monitor',
        label: 'Haşere Monitörü',
        controls: [
            { key: 'activity', label: 'Aktivite', type: 'boolean' },
            { key: 'count', label: 'Adet', type: 'number' },
        ]
    }
};

export const getEquipmentTypeLabel = (id: string) => {
    const type = Object.values(EQUIPMENT_TYPES).find(t => t.id === id);
    return type ? type.label : id;
};

export const getEquipmentControls = (id: string) => {
    const type = Object.values(EQUIPMENT_TYPES).find(t => t.id === id);
    return type ? type.controls : [];
};
