import React from 'react';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';

export interface HtmlRendererProps {
  html?: string | null;
  style?: StyleProp<ViewStyle>;
  baseTextStyle?: StyleProp<TextStyle>;
}

/** Decodes standard HTML entity codes */
const decodeHtmlEntities = (text: string): string => {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&bull;/gi, '•')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™');
};

interface InlineToken {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrike?: boolean;
  href?: string;
}

/** Parses inline tags inside a block into styled text tokens */
const parseInlineContent = (raw: string): InlineToken[] => {
  if (!raw) return [];

  // Normalize line breaks within inline text
  const clean = raw.replace(/<br\s*\/?>/gi, '\n');

  // Tokenize by HTML tags: <b>, <strong>, <i>, <em>, <u>, <s>, <del>, <a href="...">, and closing tags
  const tagRegex = /<(\/)?([a-z0-9]+)(?:\s+href=["']([^"']*)["'])?[^>]*>/gi;
  const tokens: InlineToken[] = [];

  let lastIndex = 0;
  let boldCount = 0;
  let italicCount = 0;
  let underlineCount = 0;
  let strikeCount = 0;
  let currentHref: string | undefined = undefined;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(clean)) !== null) {
    const textBefore = clean.substring(lastIndex, match.index);
    if (textBefore) {
      tokens.push({
        text: decodeHtmlEntities(textBefore),
        isBold: boldCount > 0,
        isItalic: italicCount > 0,
        isUnderline: underlineCount > 0,
        isStrike: strikeCount > 0,
        href: currentHref,
      });
    }

    const isClosing = Boolean(match[1]);
    const tagName = (match[2] || '').toLowerCase();
    const hrefAttr = match[3];

    if (tagName === 'b' || tagName === 'strong') {
      boldCount = isClosing ? Math.max(0, boldCount - 1) : boldCount + 1;
    } else if (tagName === 'i' || tagName === 'em') {
      italicCount = isClosing ? Math.max(0, italicCount - 1) : italicCount + 1;
    } else if (tagName === 'u') {
      underlineCount = isClosing ? Math.max(0, underlineCount - 1) : underlineCount + 1;
    } else if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
      strikeCount = isClosing ? Math.max(0, strikeCount - 1) : strikeCount + 1;
    } else if (tagName === 'a') {
      currentHref = isClosing ? undefined : hrefAttr;
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = clean.substring(lastIndex);
  if (remaining) {
    tokens.push({
      text: decodeHtmlEntities(remaining),
      isBold: boldCount > 0,
      isItalic: italicCount > 0,
      isUnderline: underlineCount > 0,
      isStrike: strikeCount > 0,
      href: currentHref,
    });
  }

  return tokens;
};

interface BlockNode {
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'ul' | 'ol' | 'hr' | 'blockquote' | 'raw';
  content?: string;
  items?: string[]; // for lists
}

/** Parses raw HTML string into structured BlockNodes */
const parseHtmlBlocks = (html: string): BlockNode[] => {
  if (!html || !html.trim()) return [];

  // Remove full document envelope if present
  let sanitized = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?(html|body|head|meta)[^>]*>/gi, '')
    .trim();

  // If the content is markdown instead of HTML (e.g. starting with ### or containing **bold**),
  // convert basic markdown headings and bullets into HTML tags for uniform parsing
  if (!sanitized.includes('<') || sanitized.startsWith('###') || sanitized.includes('**')) {
    sanitized = sanitized
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>');
  }

  const blocks: BlockNode[] = [];
  // Match block-level elements
  const blockRegex = /<(h[1-6]|p|ul|ol|blockquote|div|hr)(?:[^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(sanitized)) !== null) {
    const textBefore = sanitized.substring(lastIndex, match.index).trim();
    if (textBefore) {
      // Split non-tagged paragraphs by double newline
      const paragraphs = textBefore.split(/\n\s*\n/);
      paragraphs.forEach(p => {
        if (p.trim()) {
          blocks.push({ type: 'p', content: p.trim() });
        }
      });
    }

    const tagName = (match[1] || 'hr').toLowerCase();
    const innerContent = match[2] || '';

    if (tagName.startsWith('h')) {
      blocks.push({ type: tagName as any, content: innerContent.trim() });
    } else if (tagName === 'p' || tagName === 'div') {
      if (innerContent.trim()) {
        blocks.push({ type: 'p', content: innerContent.trim() });
      }
    } else if (tagName === 'ul' || tagName === 'ol') {
      const listItems: string[] = [];
      const liRegex = /<li(?:[^>]*)>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      while ((liMatch = liRegex.exec(innerContent)) !== null) {
        if (liMatch[1].trim()) {
          listItems.push(liMatch[1].trim());
        }
      }
      if (listItems.length > 0) {
        blocks.push({ type: tagName as any, items: listItems });
      }
    } else if (tagName === 'blockquote') {
      blocks.push({ type: 'blockquote', content: innerContent.trim() });
    } else if (tagName === 'hr') {
      blocks.push({ type: 'hr' });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = sanitized.substring(lastIndex).trim();
  if (remaining) {
    const paragraphs = remaining.split(/\n\s*\n/);
    paragraphs.forEach(p => {
      if (p.trim()) {
        blocks.push({ type: 'p', content: p.trim() });
      }
    });
  }

  return blocks;
};

export const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  html,
  style,
  baseTextStyle,
}) => {
  const { colors, borderRadius } = useTheme();

  if (!html || !html.trim()) {
    return null;
  }

  const blocks = parseHtmlBlocks(html);

  const handleLinkPress = (url?: string) => {
    if (!url) return;
    Linking.canOpenURL(url).then(supported => {
      if (supported) Linking.openURL(url);
    });
  };

  const renderInlineTokens = (rawContent: string, inheritStyle?: TextStyle) => {
    const tokens = parseInlineContent(rawContent);

    return tokens.map((token, index) => {
      const tokenStyle: TextStyle = {
        ...inheritStyle,
        fontWeight: token.isBold ? '700' : inheritStyle?.fontWeight || '400',
        fontStyle: token.isItalic ? 'italic' : undefined,
        textDecorationLine:
          token.isUnderline && token.isStrike
            ? 'underline line-through'
            : token.isUnderline
            ? 'underline'
            : token.isStrike
            ? 'line-through'
            : token.href
            ? 'underline'
            : undefined,
        color: token.href ? colors.primary : inheritStyle?.color || colors.textPrimary,
      };

      if (token.href) {
        return (
          <TouchableOpacity
            key={`link_${index}`}
            onPress={() => handleLinkPress(token.href)}
            activeOpacity={0.7}
          >
            <Text style={tokenStyle}>{token.text}</Text>
          </TouchableOpacity>
        );
      }

      return (
        <Text key={`token_${index}`} style={tokenStyle}>
          {token.text}
        </Text>
      );
    });
  };

  return (
    <View style={[styles.container, style]}>
      {blocks.map((block, bIndex) => {
        switch (block.type) {
          case 'h1':
            return (
              <Text
                key={`h1_${bIndex}`}
                style={[
                  styles.h1,
                  { color: colors.textPrimary },
                  baseTextStyle,
                ]}
              >
                {renderInlineTokens(block.content || '', {
                  fontSize: 20,
                  fontWeight: '800',
                  color: colors.textPrimary,
                })}
              </Text>
            );

          case 'h2':
            return (
              <Text
                key={`h2_${bIndex}`}
                style={[
                  styles.h2,
                  { color: colors.textPrimary },
                  baseTextStyle,
                ]}
              >
                {renderInlineTokens(block.content || '', {
                  fontSize: 17,
                  fontWeight: '800',
                  color: colors.textPrimary,
                })}
              </Text>
            );

          case 'h3':
            return (
              <Text
                key={`h3_${bIndex}`}
                style={[
                  styles.h3,
                  { color: colors.textPrimary },
                  baseTextStyle,
                ]}
              >
                {renderInlineTokens(block.content || '', {
                  fontSize: 15,
                  fontWeight: '700',
                  color: colors.textPrimary,
                })}
              </Text>
            );

          case 'h4':
          case 'h5':
          case 'h6':
            return (
              <Text
                key={`h4_${bIndex}`}
                style={[
                  styles.h4,
                  { color: colors.textPrimary },
                  baseTextStyle,
                ]}
              >
                {renderInlineTokens(block.content || '', {
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.textPrimary,
                })}
              </Text>
            );

          case 'ul':
            return (
              <View key={`ul_${bIndex}`} style={styles.listContainer}>
                {block.items?.map((item, lIndex) => (
                  <View key={`li_${lIndex}`} style={styles.listItemRow}>
                    <Text style={[styles.bulletPoint, { color: colors.primary }]}>•</Text>
                    <Text style={[styles.listItemText, { color: colors.textPrimary }, baseTextStyle]}>
                      {renderInlineTokens(item, {
                        fontSize: 13,
                        lineHeight: 19,
                        color: colors.textPrimary,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            );

          case 'ol':
            return (
              <View key={`ol_${bIndex}`} style={styles.listContainer}>
                {block.items?.map((item, lIndex) => (
                  <View key={`li_${lIndex}`} style={styles.listItemRow}>
                    <Text style={[styles.numberPoint, { color: colors.primary }]}>
                      {lIndex + 1}.
                    </Text>
                    <Text style={[styles.listItemText, { color: colors.textPrimary }, baseTextStyle]}>
                      {renderInlineTokens(item, {
                        fontSize: 13,
                        lineHeight: 19,
                        color: colors.textPrimary,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            );

          case 'blockquote':
            return (
              <View
                key={`quote_${bIndex}`}
                style={[
                  styles.blockquote,
                  {
                    borderLeftColor: colors.primary,
                    backgroundColor: colors.surfaceVariant,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Text style={[styles.quoteText, { color: colors.textSecondary }, baseTextStyle]}>
                  {renderInlineTokens(block.content || '', {
                    fontStyle: 'italic',
                    color: colors.textSecondary,
                  })}
                </Text>
              </View>
            );

          case 'hr':
            return (
              <View
                key={`hr_${bIndex}`}
                style={[styles.hr, { backgroundColor: colors.border }]}
              />
            );

          case 'p':
          default:
            return (
              <Text
                key={`p_${bIndex}`}
                style={[
                  styles.paragraph,
                  { color: colors.textPrimary },
                  baseTextStyle,
                ]}
              >
                {renderInlineTokens(block.content || '', {
                  fontSize: 13,
                  lineHeight: 19,
                  color: colors.textPrimary,
                })}
              </Text>
            );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  h1: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  h4: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  listContainer: {
    marginVertical: 4,
    paddingLeft: 4,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 19,
    marginRight: 8,
    fontWeight: '800',
  },
  numberPoint: {
    fontSize: 12.5,
    lineHeight: 19,
    marginRight: 8,
    fontWeight: '700',
  },
  listItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  blockquote: {
    borderLeftWidth: 3.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  quoteText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  hr: {
    height: 1,
    marginVertical: 12,
  },
});

export default HtmlRenderer;
