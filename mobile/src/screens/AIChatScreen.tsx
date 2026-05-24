/**
 * AIChatScreen — AI copilot chat interface
 * 
 * Clean chat bubbles with purple accent for AI responses.
 * Phantom-style input bar at bottom.
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { colors, spacing, radius, typography, shadows } from '../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: any[];
  timestamp: number;
}

export default function AIChatScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hey! I\'m your AI trading copilot.\n\nI can help you with:\n• Finding high-score tokens\n• Explaining token analysis\n• Trading strategies\n• Market insights',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post('/ai/query', { message: text });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply || 'No response',
        tokens: res.tokens,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: processLocal(text),
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ChatBubble message={item} navigation={navigation} />}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* Typing indicator */}
      {isLoading && (
        <View style={styles.typingRow}>
          <View style={styles.typingDots}>
            <ActivityIndicator color={colors.purple[400]} size="small" />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about tokens..."
          placeholderTextColor={colors.text.disabled}
          returnKeyType="send"
          onSubmitEditing={send}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || isLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ message, navigation }: { message: Message; navigation: any }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleContainer, isUser && styles.bubbleContainerUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>◉</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        <Text style={[styles.bubbleText, isUser ? styles.textUser : styles.textAI]}>
          {message.content}
        </Text>

        {/* Token suggestions */}
        {message.tokens?.map((t: any, i: number) => (
          <TouchableOpacity
            key={i}
            style={styles.tokenSuggestion}
            onPress={() => navigation.navigate('TokenDetail', { token: t, mint: t.mint })}
            activeOpacity={0.7}
          >
            <View style={styles.tokenSugLeft}>
              <Text style={styles.tokenSugSymbol}>{t.symbol}</Text>
            </View>
            <View style={styles.tokenSugBadge}>
              <Text style={styles.tokenSugScore}>{t.score}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Offline AI responses
function processLocal(q: string): string {
  const l = q.toLowerCase();
  if (l.includes('bundle') || l.includes('bundl'))
    return 'Bundling is when a deployer uses multiple wallets to buy their own token at launch (within 2 seconds). SniperAI detects 3+ wallets buying simultaneously and automatically skips these tokens.';
  if (l.includes('strategy') || l.includes('tip'))
    return 'Recommended Strategy:\n\n1. Only trade tokens with score ≥ 70\n2. Max 0.5 SOL per snipe\n3. Take profit: 50% at 2x, 30% at 3x\n4. Stop loss: -40%\n5. Max 3 concurrent positions\n6. Always skip bundled launches';
  if (l.includes('score') || l.includes('explain'))
    return 'Score Breakdown (0-100):\n\n• Momentum — buy count & volume\n• Organic — unique buyer ratio\n• Distribution — holder spread\n• Dev wallet — deployer holding %\n• Bonding curve — progress\n• Bundle check — launch pattern\n\n≥70 = SNIPE\n50-69 = WATCH\n<50 = SKIP';
  if (l.includes('trending') || l.includes('hot'))
    return 'Check the Discover tab for live trending tokens with real-time scores!';
  return 'I can help with:\n\n• "What is bundling?"\n• "Best trading strategy"\n• "Explain the scoring system"\n• "Show trending tokens"';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  chatList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    maxWidth: '88%',
  },
  bubbleContainerUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.purple[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: 2,
  },
  aiAvatarText: {
    fontSize: 14,
    color: '#FFF',
  },
  bubble: {
    borderRadius: radius.xl,
    padding: spacing.md,
    maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: colors.purple[500],
    borderBottomRightRadius: radius.xs,
  },
  bubbleAI: {
    backgroundColor: colors.bg.secondary,
    borderBottomLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  bubbleText: {
    ...typography.body,
    lineHeight: 21,
  },
  textUser: {
    color: '#FFFFFF',
  },
  textAI: {
    color: colors.text.secondary,
  },
  tokenSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  tokenSugLeft: {},
  tokenSugSymbol: {
    ...typography.label,
    color: colors.text.primary,
  },
  tokenSugBadge: {
    backgroundColor: `${colors.purple[400]}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tokenSugScore: {
    ...typography.numberSm,
    color: colors.purple[400],
  },
  typingRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typingText: {
    ...typography.bodySm,
    color: colors.text.tertiary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.primary,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purple[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    ...shadows.purple,
  },
  sendBtnDisabled: {
    backgroundColor: colors.bg.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
