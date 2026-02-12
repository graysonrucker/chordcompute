INSERT OR IGNORE INTO notes (id, name) VALUES
(0, 'C'),
(1, 'C#'),
(2, 'D'),
(3, 'D#'),
(4, 'E'),
(5, 'F'),
(6, 'F#'),
(7, 'G'),
(8, 'G#'),
(9, 'A'),
(10, 'A#'),
(11, 'B');

INSERT OR IGNORE INTO chord_types (name, intervals) VALUES
('major', '0,4,7'),
('major6', '0,4,7,9'),
('major7', '0,4,7,11'),
('major9', '0,4,7,11,14'),
('major13', '0,4,7,11,14,21'),
('minor', '0,3,7'),
('minor7', '0,3,7,10'),
('diminished', '0,3,6'),
('augmented', '0,4,8');
