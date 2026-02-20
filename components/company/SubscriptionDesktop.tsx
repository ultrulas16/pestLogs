import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DesktopLayout } from '@/components/DesktopLayout';
import SubscriptionScreen from '@/app/company/subscription';

export default function SubscriptionDesktop() {
    return (
        <DesktopLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* We can reuse the existing screen content, or rebuild if it's too tied to mobile layout. 
             Ideally the existing screen should be refactored to be a "Content" component.
             For now, let's try to wrap it, but the existing screen has its own Header and Back button which might look weird.
             
             Better approach: The existing screen has a full page layout. 
             If we render it inside DesktopLayout, it will have double headers.
             
             Let's Create a clean desktop view that reuses the logic if possible, 
             OR just accept that we need to modify the original file to be responsive.
          */}
                <View style={styles.container}>
                    {/* Since we can't easily extract the logic without refactoring the original file heavily,
                 I will modify the original file to handle desktop layout internally, similar to company.tsx 
              */}
                </View>
            </ScrollView>
        </DesktopLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
});
