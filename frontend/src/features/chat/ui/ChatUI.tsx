import { useEffect, useRef, useState } from 'react';
import styles from './ChatUI.module.scss';
import busybee2 from '../../../shared/assets/images/busybee2.png';
import { MessageProps } from '../model/ChatModel';
import { Voice } from '../..';
import useWebSocket from '../hooks/useWebSocket';

const messagesData: MessageProps[] = [
  {
    sender: 'admin',
    content: `안녕하세요!👋
물류 견적 요청을 도와드릴 챗봇입니다. 이메일로 보내주신 요청을 확인했습니다.
아래는 견적 요청 메일을 통해 파악한 정보입니다
표
견적 산출을 위해 추가적인 정보가 몇 가지 필요f합니다
지금부터 필요한 정보를 하나씩 요청드리겠습니다.`,
  },
  {
    sender: 'admin',
    content: `누락정보 요청
먼저 누락된 무게를 입력해주세요.`,
  },
];

export const ChatUI = () => {
  const [messages, setMessages] = useState(messagesData);
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const orderId = new URLSearchParams(window.location.search).get('orderId');

  const { sendMessage } = useWebSocket(orderId);

  useEffect(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('signInDetails')) {
        const signInDetails = localStorage.getItem(key);
        if (signInDetails) {
          const details = JSON.parse(signInDetails);
          setUserId(details.loginId);
        }
        break;
      }
    }
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim()) {
      setMessages([...messages, { sender: 'user', content: input }]);
      const message = { action: 'sendMessage', message: input };
      sendMessage(message);
      setInput('');
    }
  };

  const handleTranscriptChange = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      setInput((prevInput) => prevInput + transcript);
    } else if (!isFinal) {
      setInput(transcript);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div></div>
        <div className={styles.middle}>
          <img src={busybee2} alt='' height={55} />
          <h1>BUSYBEE</h1>
        </div>
        <div></div>
      </div>
      <div className={styles.userId}>
        {userId}
        <img src={busybee2} alt='' height={45} />
      </div>
      <div className={styles.chat} ref={chatRef}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`${styles.messageContainer} ${styles[message.sender]}`}
          >
            {message.sender === 'admin' ? (
              <div className={styles.profileContainer}>
                <img src={busybee2} alt='' width={45} height={45} />
                <div className={`${styles.message} ${styles[message.sender]}`}>
                  {message.content}
                </div>
              </div>
            ) : (
              <div className={`${styles.message} ${styles[message.sender]}`}>
                {message.content}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.textInput}>
        <input
          type='text'
          ref={inputRef} // inputRef 연결
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <div className={styles.button} onClick={handleSend}>
          보내기
        </div>
        <Voice onTranscriptChange={handleTranscriptChange} />
      </div>
      <div className={styles.warningMessage}>
        음성 녹음 시 대화가 초기화됩니다.
      </div>
    </div>
  );
};
