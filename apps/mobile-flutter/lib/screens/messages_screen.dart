import 'package:flutter/material.dart';
import '../theme.dart';

class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: C.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Text('Messages', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: C.ink)),
            ),
            const Expanded(
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.chat_bubble_outline, size: 56, color: C.muted),
                  SizedBox(height: 12),
                  Text('No messages yet', style: TextStyle(color: C.muted, fontSize: 16, fontWeight: FontWeight.w700)),
                  SizedBox(height: 4),
                  Text('Chats with your pros will appear here.', style: TextStyle(color: C.muted)),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
