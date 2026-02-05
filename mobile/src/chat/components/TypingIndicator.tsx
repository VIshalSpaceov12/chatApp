import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  userNames: string[];
}

export const TypingIndicator: React.FC<Props> = ({ userNames }) => {
  if (userNames.length === 0) return null;

  const text =
    userNames.length === 1
      ? `${userNames[0]} is typing...`
      : userNames.length === 2
      ? `${userNames[0]} and ${userNames[1]} are typing...`
      : `${userNames[0]} and ${userNames.length - 1} others are typing...`;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dots: {
    flexDirection: 'row',
    marginRight: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
    marginHorizontal: 2,
  },
  text: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});

export default TypingIndicator;
