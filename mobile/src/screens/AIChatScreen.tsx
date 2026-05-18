/**
 * AIChatScreen — Natural language token discovery + explanation
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: any[];
}

export default function AIChatScreen({ navigation }: any) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: '👋 I\'m your AI copilot.\n\nTry:\n• "Find tokens >80 score"\n• "What is bundling?"\n• "Best strategy?"\n• "Show trending"' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await api.post('/ai/query', { message: text });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: res.reply || 'No response', tokens: res.tokens,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: processLocal(text),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd(), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
            <Text style={[styles.text, item.role === 'user' ? styles.textUser : styles.textAI]}>{item.content}</Text>
            {item.tokens?.map((t: any, i: number) => (
              <TouchableOpacity key={i} style={styles.tokenRow} onPress={() => navigation.navigate('TokenDetail', { token: t, mint: t.mint })}>
                <Text style={styles.tokenSym}>{t.symbol}</Text>
                <Text style={styles.tokenScore}>Score: {t.score}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />
      {isLoading && <View style={styles.loading}><ActivityIndicator color="#00d4aa" /><Text style={styles.loadText}>Thinking...</Text></View>}
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask about tokens..." placeholderTextColor="#555" returnKeyType="send" onSubmitEditing={send} />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && { backgroundColor: '#333' }]} onPress={send} disabled={!input.trim() || isLoading}>
          <Text style={{ fontSize: 20 }}>🚀</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function processLocal(q: string): string {
  const l = q.toLowerCase();
  if (l.includes('bundle')) return '🚫 Bundling = deployer uses multiple wallets to buy their own token at launch (<2s). Our bot detects >3 wallets buying simultaneously and auto-skips.';
  if (l.includes('strategy') || l.includes('tip')) return '💡 Strategy:\n1. Only score ≥70\n2. Max 0.5 SOL/snipe\n3. TP: 50% @2x, 30% @3x\n4. SL: -40%\n5. Max 3 positions\n6. Skip bundles always';
  if (l.includes('score') || l.includes('explain')) return '📊 Score (0-100):\n• Momentum (buys, volume)\n• Organic check (unique buyers)\n• Holder distribution\n• Dev wallet %\n• Bonding curve\n• Bundle detection\n\n≥70=SNIPE, 50-69=WATCH, <50=SKIP';
  if (l.includes('trending') || l.includes('hot')) return '🔥 Check the Feed tab for live trending tokens!';
  return '🤔 Try: "What is bundling?", "Best strategy?", "Explain score"';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleUser: { backgroundColor: '#00d4aa', alignSelf: 'flex-end' },
  bubbleAI: { backgroundColor: '#1a1a2e', alignSelf: 'flex-start' },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: '#000' },
  textAI: { color: '#ddd' },
  tokenRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#252540', borderRadius: 8, padding: 8, marginTop: 6 },
  tokenSym: { color: '#fff', fontWeight: '700' },
  tokenScore: { color: '#00d4aa', fontWeight: '600' },
  loading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  loadText: { color: '#888', marginLeft: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  input: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', marginRight: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4aa', alignItems: 'center', justifyContent: 'center' },
});
