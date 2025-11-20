import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.text}>
          Här kommer du kunna ställa in namn, veckomål och andra inställningar för din träning.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 16 },
  text: { fontSize: 15, color: '#d1d5db' },
});
