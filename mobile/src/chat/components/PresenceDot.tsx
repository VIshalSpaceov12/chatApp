import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  isOnline: boolean;
  size?: number;
}

export const PresenceDot: React.FC<Props> = ({ isOnline, size = 10 }) => {
  return (
    <View
      style={[
        styles.dot,
        isOnline ? styles.online : styles.offline,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  online: {
    backgroundColor: '#34C759',
  },
  offline: {
    backgroundColor: '#8E8E93',
  },
});

export default PresenceDot;
